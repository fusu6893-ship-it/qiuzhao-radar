/* ------------------------------------------------------------------
 * ai.js — 本地可解释的「AI 能力」引擎
 *
 * 设计原则：产品演示时，关键场景需要真正跑通，而不是只贴一张截图。
 * 因此这里实现了一套可离线运行、结果可解释的规则引擎：
 *   JD 解析 / 岗位匹配 / 简历定制 / 面试问题生成 / 回答评估
 * 同时保留可选的远程大模型通道（OpenAI 兼容接口），用于替换成真实模型。
 * ---------------------------------------------------------------- */
(function (window) {
  'use strict';

  var D = window.AIData;

  /* ============================ 工具函数 ============================ */

  function uniq(arr) {
    var seen = {}, out = [];
    (arr || []).forEach(function (x) {
      var k = String(x == null ? '' : x).trim();
      if (k && !seen[k]) { seen[k] = 1; out.push(k); }
    });
    return out;
  }

  function hit(text, word) {
    if (!text || !word) return false;
    var t = String(text).toLowerCase().replace(/\s+/g, '');
    var w = String(word).toLowerCase().replace(/\s+/g, '');
    return t.indexOf(w) !== -1;
  }

  /* 同义词扩展：命中任一别名即视为命中该技能 */
  function variants(skill) {
    return uniq([skill].concat(D.SKILL_ALIAS[skill] || []));
  }

  function containsSkill(text, skill) {
    var vs = variants(skill);
    for (var i = 0; i < vs.length; i++) if (hit(text, vs[i])) return vs[i];
    return null;
  }

  /* 简历全文（用于关键词命中） */
  function resumeText(resume) {
    if (!resume) return '';
    var parts = [];
    parts.push(resume.basics && resume.basics.headline);
    (resume.education || []).forEach(function (e) { parts.push(e.school, e.degree, e.detail); });
    (resume.internships || []).forEach(function (e) {
      parts.push(e.company, e.role);
      (e.bullets || []).forEach(function (b) { parts.push(b); });
    });
    (resume.projects || []).forEach(function (e) {
      parts.push(e.name, e.role);
      (e.bullets || []).forEach(function (b) { parts.push(b); });
    });
    (resume.skills || []).forEach(function (s) { parts.push(s); });
    (resume.awards || []).forEach(function (s) { parts.push(s); });
    return parts.filter(Boolean).join(' ');
  }

  /* 为某条技能在简历中寻找证据（可解释性的关键） */
  function findEvidence(resume, skill) {
    var out = [];
    if (!resume) return out;
    var vs = variants(skill);
    function scan(container, label, name) {
      (container || []).forEach(function (item) {
        (item.bullets || []).forEach(function (b) {
          for (var i = 0; i < vs.length; i++) {
            if (hit(b, vs[i])) {
              out.push({ section: label, name: name, text: b, matched: vs[i] });
              return;
            }
          }
        });
      });
    }
    scan(resume.projects, '项目经历', '');
    scan(resume.internships, '实习经历', '');
    (resume.skills || []).forEach(function (s) {
      for (var i = 0; i < vs.length; i++) {
        if (hit(s, vs[i])) { out.push({ section: '技能标签', name: '', text: s, matched: vs[i] }); return; }
      }
    });
    return out.slice(0, 3);
  }

  /* ======================= 1. JD / 招聘文本解析 ======================= */

  var CITY_LIST = ['北京', '上海', '深圳', '广州', '杭州', '成都', '武汉', '南京', '西安', '苏州', '长沙', '重庆'];
  var TITLE_HINTS = ['产品经理', '数据分析师', '数据产品经理', '运营', '产品运营', '增长', '交互设计师', '策略运营', '算法', '开发工程师', '产品'];
  /* 公司名后缀词表：用于从招聘文本中定位企业名称 */
  var COMPANY_SUFFIX = '(?:有限公司|股份有限公司|集团|控股|科技|网络|智能|数据|互娱|传媒|信息|出行|软件|实业|教育|游戏|电商|文化|通信|电子|生物|医药|银行|证券|保险|能源|汽车|物流)';
  var COMPANY_RE = new RegExp('([\\u4e00-\\u9fa5A-Za-z]{2,12}' + COMPANY_SUFFIX + ')');

  function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }

  /** 把「2026 年 10 月 27 日 / 10月27日 / 2026-10-27 / 10.27」统一成 2026-10-27 */
  function normalizeDate(raw) {
    var s = String(raw).replace(/\s/g, '');
    var m, y = String(D.META.today).slice(0, 4);
    if ((m = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/))) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
    if ((m = s.match(/(\d{1,2})月(\d{1,2})日?/))) return y + '-' + pad2(m[1]) + '-' + pad2(m[2]);
    if ((m = s.match(/(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/))) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
    if ((m = s.match(/(\d{1,2})[-.\/](\d{1,2})/))) return y + '-' + pad2(m[1]) + '-' + pad2(m[2]);
    return String(raw).trim();
  }

  /**
   * 把一段招聘文本解析成结构化岗位卡片
   * @param {string} raw 用户粘贴的 JD 文本或链接
   * @param {object} fallback 兜底信息（如来源链接）
   */
  function parseJob(raw, fallback) {
    var text = String(raw || '').trim();
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var flat = lines.join(' ');

    /* 岗位名称 */
    var title = '';
    lines.some(function (l) {
      var t = l.replace(/^[#\-*\s【】\[\]]+/, '')
        .replace(/^(岗位名称|职位名称|招聘岗位|岗位|职位)[:：]\s*/, '')
        .replace(/[（(](校招|社招|2027届)[^）)]*[）)]/g, '').trim();
      var isTitle = TITLE_HINTS.some(function (h) { return hit(t, h); });
      if (isTitle && t.length <= 24) { title = t; return true; }
      return false;
    });
    if (!title) {
      TITLE_HINTS.some(function (h) { if (hit(flat, h)) { title = h; return true; } return false; });
    }

    /* 公司名称：优先看标题区（前两行），再退回全文 */
    var company = '';
    var head = lines.slice(0, 2).join(' ');
    var cm = head.match(COMPANY_RE) || flat.match(COMPANY_RE);
    if (cm) company = cm[1];
    if (!company) {
      var cm2 = flat.match(/(?:公司名称|招聘方|公司|企业)[:：]\s*([\u4e00-\u9fa5A-Za-z]{2,14})/);
      if (cm2) company = cm2[1].trim();
    }
    if (company) company = company.replace(/^(公司名称|招聘方|公司|企业)[:：]?/, '');

    /* 城市 */
    var cities = CITY_LIST.filter(function (c) { return hit(flat, c); }).slice(0, 3);

    /* 学历 */
    var degree = '学历要求未识别';
    if (/博士/.test(flat)) degree = '博士及以上';
    else if (/硕士|研究生/.test(flat)) degree = '硕士及以上';
    else if (/本科|学士/.test(flat)) degree = '本科及以上';
    else if (/大专|专科/.test(flat)) degree = '大专及以上';

    /* 职责 / 要求 段落切分 */
    var resp = [], req = [], nice = [], bucket = null;
    lines.forEach(function (l) {
      var l2 = l.replace(/^[#\-*•·\d.、\s]+/, '').trim();
      if (!l2) return;
      if (/^(岗位职责|工作职责|职责描述|你会做|你将负责)/.test(l2) || /职责/.test(l2) && l2.length < 14) { bucket = resp; return; }
      if (/^(任职要求|岗位要求|任职资格|我们希望你|职位要求)/.test(l2) || /要求/.test(l2) && l2.length < 14) { bucket = req; return; }
      if (/^(加分项|优先|nice to have)/i.test(l2)) { bucket = nice; return; }
      if (bucket && l2 !== lines[0]) {
        if (l2.length > 4 && l2.length < 160) bucket.push(l2);
      } else if (!bucket && /[。；;]/.test(l2) && l2.length > 18 && l2.length < 200) {
        /* 没有小标题时，按句分配：含「要求/优先/能力」的进要求，其余进职责 */
        if (/(要求|优先|熟练|掌握|具备|经验)/.test(l2)) req.push(l2);
        else resp.push(l2);
      }
    });

    /* 关键词抽取 */
    var allDirs = Object.keys(D.SKILL_LEXICON);
    var keywords = [];
    allDirs.forEach(function (dir) {
      D.SKILL_LEXICON[dir].forEach(function (skill) {
        if (containsSkill(flat, skill)) keywords.push(skill);
      });
    });
    keywords = uniq(keywords);

    /* 方向判定 */
    var direction = '产品';
    var best = -1;
    allDirs.forEach(function (dir) {
      var c = D.SKILL_LEXICON[dir].filter(function (s) { return keywords.indexOf(s) !== -1; }).length;
      if (c > best) { best = c; direction = dir; }
    });
    if (title) {
      if (/运营/.test(title)) direction = '运营';
      if (/数据|分析/.test(title)) direction = '数据';
      if (/设计/.test(title)) direction = '设计';
    }

    /* 截止时间 */
    var deadline = '待官方确认';
    var dm = flat.match(/(截止|截至)[^\d\n]{0,8}(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日|\d{1,2}\s*月\s*\d{1,2}\s*日|\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}|\d{1,2}[-.\/]\d{1,2})/);
    if (dm) deadline = normalizeDate(dm[2]);

    var src = (fallback && fallback.sources) || [{
      channel: (fallback && fallback.channel) || '手动导入',
      url: (fallback && fallback.url) || '',
      publishedAt: (fallback && fallback.publishedAt) || D.META.today,
      verifiedAt: D.META.today
    }];

    return {
      id: 'job-imported-' + Date.now(),
      company: company || '待补充公司名称',
      logoText: (company || '待').slice(0, 1),
      logoColor: '#6b7f9e',
      industry: '待补充',
      title: title || '待补充岗位名称',
      direction: direction,
      city: cities[0] || '待补充',
      cities: cities.length ? cities : ['待补充'],
      degree: degree,
      batch: /校招|校园招聘/.test(flat) ? '校园招聘' : '招聘信息',
      salary: (flat.match(/\d{2,3}\s*[-~]\s*\d{2,3}\s*[Kk]/) || ['薪资待确认'])[0],
      sourceType: 'official',
      status: 'unknown',
      deadline: deadline,
      sources: src,
      summary: resp[0] || '手动导入的招聘信息，字段由 AI 初步解析，请核对后使用。',
      responsibilities: resp.slice(0, 6),
      requirements: req.slice(0, 6),
      nice: nice.slice(0, 4),
      keywords: keywords.slice(0, 12),
      imported: true,
      needsReview: true,
      raw: text.slice(0, 4000)
    };
  }

  /* ========================= 2. 岗位匹配分析 ========================= */

  /**
   * 输出「为什么匹配 / 差距在哪 / 怎么改善」，而不是只给一个分数
   */
  function matchJob(job, profile, resume) {
    var jdSkills = uniq((job.keywords || []).concat(
      (job.requirements || []).map(function (r) {
        return Object.keys(D.SKILL_LEXICON).reduce(function (acc, dir) {
          return acc.concat(D.SKILL_LEXICON[dir].filter(function (s) { return containsSkill(r, s); }));
        }, []);
      }).reduce(function (a, b) { return a.concat(b); }, [])
    )).slice(0, 12);

    var advantages = [], gaps = [], matched = [], missing = [];

    jdSkills.forEach(function (skill) {
      var ev = findEvidence(resume, skill);
      if (ev.length) {
        matched.push(skill);
        advantages.push({ skill: skill, evidence: ev });
      } else {
        missing.push(skill);
      }
    });

    /* 权重计算：技能 60 / 方向 15 / 城市 10 / 学历 10 / 经历丰富度 5 */
    var skillScore = jdSkills.length ? matched.length / jdSkills.length : 0.5;
    var score = 40 + skillScore * 45;

    if ((profile.directions || []).indexOf(job.direction) !== -1) score += 8;
    else score -= 4;

    var cityHit = (job.cities || [job.city]).some(function (c) { return (profile.cities || []).indexOf(c) !== -1; });
    score += cityHit ? 6 : -3;

    var degreeRank = { '大专及以上': 1, '本科及以上': 2, '硕士及以上': 3, '博士及以上': 4 };
    var userRank = ({ '大专': 1, '本科': 2, '硕士': 3, '博士': 4 })[profile.degree] || 3;
    if (userRank >= (degreeRank[job.degree] || 2)) score += 4; else score -= 8;

    if ((job.sources || []).every(function (s) { return /公众号|小红书/.test(s.channel); })) score -= 2;

    score = Math.max(46, Math.min(96, Math.round(score)));

    /* 差距描述 */
    missing.slice(0, 4).forEach(function (skill) {
      gaps.push({
        skill: skill,
        desc: '岗位在要求中提到「' + skill + '」，但原始简历中暂时没有找到对应的经历或成果描述。'
      });
    });
    if ((profile.directions || []).indexOf(job.direction) === -1) {
      gaps.push({ skill: '方向差异', desc: '该岗位属于「' + job.direction + '」方向，与你的目标方向不完全一致，建议评估是否值得投入。' });
    }
    if (!cityHit) {
      gaps.push({ skill: '城市差异', desc: '岗位工作城市为 ' + (job.cities || [job.city]).join(' / ') + '，不在你目前的目标城市范围内。' });
    }

    /* 下一步建议 */
    var suggestions = [];
    matched.slice(0, 3).forEach(function (s) {
      suggestions.push('在简历中优先展示与「' + s + '」相关的经历，并补充可验证的规模或结果数据。');
    });
    missing.slice(0, 2).forEach(function (s) {
      suggestions.push('补充一项能体现「' + s + '」的经历：可以是课程项目、个人项目或自主研究，但要写清你实际做了什么。');
    });
    suggestions.push('投递前用「AI 简历工坊」生成该岗位的定制版本，并逐条核对事实是否与真实经历一致。');
    if (job.needsReview) suggestions.push('该岗位由手动导入的文本解析而来，请核对公司、岗位名称与截止时间是否准确。');

    /* 匹配理由一句话 */
    var reason = matched.length
      ? '你的项目/实习经历覆盖了岗位要求的 ' + matched.length + ' 项关键能力（' + matched.slice(0, 3).join('、') + '），与岗位方向存在较高关联。'
      : '目前尚未在简历中找到与岗位关键要求直接对应的经历，建议先补充相关项目再评估投递。';

    return {
      score: score,
      reason: reason,
      matchedSkills: matched,
      missingSkills: missing,
      advantages: advantages,
      gaps: gaps,
      suggestions: suggestions.slice(0, 5),
      cityHit: cityHit,
      directionHit: (profile.directions || []).indexOf(job.direction) !== -1,
      jdSkills: jdSkills
    };
  }

  /* ========================= 3. AI 简历定制 ========================= */

  /* 行动短语库：把「参与…负责部分…」这类弱表达升级为具体的动作描述 */
  var ACTION_PHRASE = {
    '需求分析': '梳理核心使用流程与功能需求，输出需求说明文档',
    '用户调研': '通过用户访谈与问卷开展需求调研，归纳高频问题与真实场景',
    '原型设计': '完成产品原型设计与方案迭代，推动需求从识别到落地',
    '数据驱动': '结合数据表现定位关键问题，并据此调整方案',
    'A/B测试': '设计对照实验验证方案效果，依据实验结论决定是否全量',
    '跨部门协作': '协同设计、研发与运营推进方案落地',
    '指标体系': '拆解核心指标并建立可跟踪的观测口径',
    '用户增长': '围绕拉新与留存设计增长方案并跟踪转化表现',
    '商业化': '分析付费链路中的流失节点并提出优化方向',
    '项目管理': '制定排期并跟进各环节进度，及时暴露风险',
    '数据分析': '对业务数据做清洗与统计，输出可支撑决策的结论',
    '内容运营': '围绕目标人群策划内容主题并复盘内容表现',
    '活动策划': '策划活动方案、设计参与路径并复盘活动数据',
    '转化率': '拆解关键转化链路，定位并优化流失环节'
  };

  function detectSkillsIn(text) {
    var all = Object.keys(D.SKILL_LEXICON).reduce(function (a, d) { return a.concat(D.SKILL_LEXICON[d]); }, []);
    return uniq(all.filter(function (s) { return containsSkill(text, s); }));
  }

  function hasMetric(text) {
    return /\d+\s*(%|个百分点|倍|万|千|人|条|个|次|小时|天|元)/.test(text || '');
  }

  /**
   * 生成简历定制建议（逐条可接受 / 修改 / 撤销）
   */
  function tailorResume(resume, job, match) {
    var jdSkills = match.jdSkills || job.keywords || [];
    var changes = [];
    var counter = 0;

    function pushChange(c) {
      counter += 1;
      c.id = 'chg-' + counter;
      c.status = 'pending';
      changes.push(c);
      return c;
    }

    /* (1) 项目 / 实习 bullet 改写 —— 只改写与岗位关键词相关的条目 */
    function processList(list, sectionLabel) {
      (list || []).forEach(function (item) {
        var relevant = detectSkillsIn((item.bullets || []).join(' ')).filter(function (s) { return jdSkills.indexOf(s) !== -1; });
        if (!relevant.length) return;
        (item.bullets || []).forEach(function (b, idx) {
          var bulletSkills = detectSkillsIn(b).filter(function (s) { return jdSkills.indexOf(s) !== -1; });
          if (!bulletSkills.length) return;
          var keep = bulletSkills.slice(0, 2);
          var extra = keep.map(function (s) { return ACTION_PHRASE[s]; }).filter(Boolean);
          var base = b.replace(/[。；;]\s*$/, '');
          var after = base;
          if (!/负责|主导|推动|完成|设计|梳理|输出|搭建|策划/.test(base)) {
            after = '负责' + base.replace(/^(参与|协助|帮助)/, '');
          }
          after = after.replace(/^(参与|协助)/, function () { return ''; });
          if (extra.length) {
            after = after.replace(/[。]?$/, '') + '，' + extra.join('，') + '。';
          }
          if (after === b) return;
          var notes = [];
          notes.push('原句中的「参与 / 协助 / 部分」等表达无法体现你的实际贡献，改写后明确了具体动作。');
          if (keep.length) notes.push('补充了岗位 JD 关注的关键词：' + keep.join('、') + '。');
          if (!hasMetric(after)) notes.push('⚠️ 仍需你补充事实：这条经历缺少可验证的数据（如样本量、覆盖人数、提升幅度），请在导出前自行确认并填写。');

          pushChange({
            section: sectionLabel,
            itemName: (item.name || item.company || item.role || ''),
            bulletIndex: idx,
            keywords: keep,
            before: b,
            after: after,
            reason: notes.join(' '),
            needsFact: !hasMetric(after)
          });
        });
      });
    }
    processList(resume.projects, '项目经历');
    processList(resume.internships, '实习经历');

    /* (2) 经历排序建议：把最相关的项目提到第一位 */
    if ((resume.projects || []).length > 1) {
      var scored = resume.projects.map(function (p, i) {
        var txt = (p.bullets || []).join(' ') + ' ' + p.name;
        var sc = detectSkillsIn(txt).filter(function (s) { return jdSkills.indexOf(s) !== -1; }).length;
        return { p: p, i: i, sc: sc };
      }).sort(function (a, b) { return b.sc - a.sc; });
      var firstNow = (resume.projects[0] || {}).name;
      var firstBest = scored[0].p.name;
      if (firstNow && firstBest && firstNow !== firstBest) {
        pushChange({
          section: '结构调整',
          itemName: firstBest,
          keywords: [],
          before: '当前顺序：' + resume.projects.map(function (p) { return p.name; }).join(' → '),
          after: '建议顺序：' + scored.map(function (s) { return s.p.name; }).join(' → '),
          reason: '「' + firstBest + '」与岗位要求的匹配度更高，建议前置，让招聘方在前 10 秒内看到最相关的经历。',
          structural: true
        });
      }
    }

    /* (3) 关键词缺口提示 */
    var missing = match.missingSkills || [];
    if (missing.length) {
      pushChange({
        section: '能力缺口',
        itemName: '关键词覆盖',
        keywords: missing.slice(0, 4),
        before: '简历中未出现：' + missing.slice(0, 4).join('、'),
        after: '请判断是否真实具备：具备 → 补充具体经历；不具备 → 不建议写入',
        reason: '岗位 JD 提到了这些关键词，但简历中没有对应表述。AI 不会替你编造经历，请你确认后决定是否补充。',
        needsReview: true,
        noApply: true
      });
    }

    /* (4) 自我定位句 */
    pushChange({
      section: '个人简介',
      itemName: 'headline',
      keywords: jdSkills.slice(0, 3),
      before: resume.basics.headline,
      after: (profileHeadline(job, resume, jdSkills)),
      reason: '把个人定位改写为与岗位方向一致的一句话，方便面试官快速建立预期。',
      noApply: false
    });

    return changes;
  }

  function profileHeadline(job, resume, jdSkills) {
    var dir = job.title.replace(/[（(].*?[）)]/g, '');
    var skills = (jdSkills || []).slice(0, 2).join('、');
    return (resume.basics.headline.split('·').slice(-1)[0] || '应届毕业生') + ' · 目标岗位：' + dir +
      (skills ? ' · 具备' + skills + '相关项目经验' : '');
  }

  /* ========================= 4. AI 面试教练 ========================= */

  function findBestProject(resume, job) {
    var jdKeywords = job.keywords || [];
    var best = null, bestScore = -1;
    (resume.projects || []).concat(resume.internships || []).forEach(function (p) {
      var txt = ((p.bullets || []).join(' ')) + ' ' + (p.name || p.company || '');
      var sc = jdKeywords.filter(function (k) { return containsSkill(txt, k); }).length;
      if (sc > bestScore) { bestScore = sc; best = p; }
    });
    return best;
  }

  /**
   * 生成分类面试问题：真实面经题保留来源，推测题标注为「预测」
   */
  function generateQuestions(job, profile, resume, reports) {
    var out = [];
    var reportsForJob = (reports || []).filter(function (r) { return r.jobId === job.id; });

    /* 第一层：来自真实面经的问题 */
    reportsForJob.forEach(function (r) {
      r.questions.forEach(function (q) {
        out.push({
          id: 'q-real-' + r.id + '-' + out.length,
          category: r.stage,
          text: q,
          type: 'real',
          source: { name: r.source, url: r.url, publishedAt: r.publishedAt, reliability: r.reliability }
        });
      });
    });

    /* 第二层：基于 JD 与岗位属性推测的问题（明确标记为预测） */
    D.QUESTION_BLUEPRINT.forEach(function (group) {
      group.items.forEach(function (item) {
        var q = item.q
          .replace(/\{\{company\}\}/g, job.company)
          .replace(/\{\{title\}\}/g, job.title)
          .replace(/\{\{direction\}\}/g, job.direction);
        var exists = out.some(function (o) { return o.text === q; });
        if (exists) return;
        out.push({
          id: 'q-pred-' + out.length + '-' + group.category,
          category: group.category,
          text: q,
          type: 'predicted',
          source: null
        });
      });
    });

    /* 第三层：基于个人简历生成的项目深挖问题 */
    var proj = findBestProject(resume, job);
    if (proj) {
      var pname = proj.name || proj.company;
      [
        '你在「' + pname + '」中具体负责哪一部分？和队友如何分工？',
        '「' + pname + '」这个项目里，如果重做一次你会改进什么？',
        '「' + pname + '」最终的效果如何量化？'
      ].forEach(function (q) {
        out.push({ id: 'q-pers-' + out.length, category: '简历追问', text: q, type: 'personal', source: null });
      });
    }

    /* 按分类聚合 */
    var grouped = [], index = {};
    out.forEach(function (q) {
      if (!index[q.category]) {
        index[q.category] = { category: q.category, questions: [] };
        grouped.push(index[q.category]);
      }
      index[q.category].questions.push(q);
    });

    return { generatedAt: D.META.today, jobId: job.id, groups: grouped, total: out.length };
  }

  /**
   * 生成个性化回答骨架：从用户自己的经历里找素材，而不是给通用答案
   */
  function buildAnswer(question, job, resume) {
    var proj = findBestProject(resume, job);
    var pname = proj ? (proj.name || proj.company) : '（请补充一个你最相关的项目）';
    var jdSkills = (job.keywords || []).slice(0, 3);
    var bullets = (proj && proj.bullets) || [];

    var star = [];
    if (/自我介绍/.test(question.text)) {
      star = [
        { k: '背景', v: '一句话说明你的学校、专业和毕业时间：' + (resume.basics.headline || '') },
        { k: '行动', v: '用「一段实习 + 一个项目」证明你的岗位相关性，重点讲你做了什么，而不是团队做了什么。' },
        { k: '结果', v: '收尾时落到目标岗位：为什么是这个方向，你能补上团队的哪一块。' }
      ];
    } else if (/需求|调研/.test(question.text)) {
      var resultHint = bullets[1] ? '（你原始简历中的描述：「' + bullets[1] + '」，请在此补充真实结果）' : '（请补充你的真实结果数据，例如转化率、留存或满意度变化）';
      star = [
        { k: '背景', v: '「' + pname + '」面向什么用户，他们原先遇到的具体问题是什么？（建议补上用户规模或问题频次）' },
        { k: '行动', v: '你采用了哪些调研方式（访谈 / 问卷 / 行为观察），样本量是多少，如何从众多问题中识别出核心需求。' },
        { k: '决策', v: '如何根据问题频率、用户价值和实现成本确定功能优先级？有没有放弃掉的需求，为什么。' },
        { k: '结果', v: '上线或测试后得到了什么反馈？有哪些可验证的数据？' + resultHint }
      ];
    } else if (/优先级|排序/.test(question.text)) {
      star = [
        { k: '背景', v: '说明你在「' + pname + '」中面对的资源约束：时间、人手或技术成本。' },
        { k: '行动', v: '列出你使用的判断框架，例如价值 / 成本矩阵、KANO 模型或 RICE 打分。' },
        { k: '结果', v: '说明取舍后的结果，以及如果复盘你会不会调整排序。' }
      ];
    } else if (/指标|数据|下降|排查/.test(question.text)) {
      star = [
        { k: '拆解', v: '先把指标拆成公式（如留存 = 活跃 / 新增），逐层定位是哪一段在变化。' },
        { k: '验证', v: '区分是数据口径问题、外部事件还是产品改动导致，列 2-3 个待验证假设。' },
        { k: '案例', v: '结合你「' + (proj && proj.name || '') + '」里用数据做决策的经历说明你的分析习惯。' },
        { k: '收尾', v: '强调结论要能落到动作上，并说明如何跟踪改动效果。' }
      ];
    } else if (/分析一款|产品分析/.test(question.text)) {
      star = [
        { k: '是什么', v: '先用一句话说清产品解决谁的什么问题，它的核心价值主张。' },
        { k: '为什么', v: '说明它的关键机制（供给-需求-分发）以及商业化的方式。' },
        { k: '改进', v: '点出 1 个你观察到的具体问题，并给出可验证的改进方案。' }
      ];
    } else if (/失败|没达到预期/.test(question.text)) {
      star = [
        { k: '情境', v: '选择一件真实发生、且你能承担主要责任的事，不要选无关痛痒的小问题。' },
        { k: '行动', v: '说明你当时的选择和判断依据，以及你从哪一步开始意识到不对。' },
        { k: '反思', v: '给出你已经做出的改变，最好有一个后续案例证明改变奏效。' }
      ];
    } else if (/分歧|不一致/.test(question.text)) {
      star = [
        { k: '情境', v: '描述一次与同学 / 同事在方案上产生分歧的具体场景。' },
        { k: '行动', v: '你如何用数据、原型或小范围测试把主观争论变成客观验证。' },
        { k: '结果', v: '最终如何收口，关系是否受影响，你的协作方式有什么变化。' }
      ];
    } else {
      star = [
        { k: '背景', v: '交代清楚场景与你需要解决的问题。' },
        { k: '行动', v: '重点讲你个人的判断和动作，可用「我负责…我推动…我设计…」作为句式。' },
        { k: '结果', v: '给出可验证的结果，并说明你从中学到了什么。' }
      ];
    }

    var skeleton = star.map(function (s) { return s.k + '：' + s.v; }).join('\n');
    var reference =
      '我会先明确目标用户和使用场景，通过用户访谈、问卷或行为观察识别主要问题，' +
      '再根据问题频率、用户价值和实现成本确定功能优先级，随后通过原型测试或实际使用反馈验证方案效果。' +
      '在这个岗位关注的 ' + (jdSkills.join('、') || '核心能力') + ' 上，我的「' + pname + '」经历可以直接支撑。' +
      '\n\n※ 具体调研样本、结果数据和个人贡献需要结合我的真实经历补充，AI 不代为编造。';

    return {
      questionId: question.id,
      skeleton: skeleton,
      reference: reference,
      materials: bullets.slice(0, 3),
      jobKeywords: jdSkills,
      factsToFill: [
        '用户调研的样本量与调研方式',
        '你个人负责的具体模块（与团队贡献区分开）',
        '可量化的结果数据（转化率、留存、覆盖人数等）'
      ]
    };
  }

  /**
   * 回答评估：四个维度打分 + 可执行的改进建议 + 追问
   */
  function evaluateAnswer(answer, question, job) {
    var text = String(answer || '').trim();
    var len = text.length;
    var dims = {};
    var feedback = [];

    /* 逻辑结构 */
    var structureWords = ['首先', '其次', '然后', '接着', '最后', '第一', '第二', '第三', '背景', '目标', '行动', '结果', '因为', '所以', '因此', '最终'];
    var structureHits = structureWords.filter(function (w) { return hit(text, w); }).length;
    var structure = Math.min(100, 35 + structureHits * 11 + Math.min(20, Math.round(len / 12)));
    dims.structure = structure;
    if (structureHits < 2) feedback.push('表达缺少清晰的结构信号。建议用「背景 → 行动 → 结果」三段式，并在开头给出结论。');
    else feedback.push('结构较清晰，使用了 ' + structureHits + ' 个逻辑连接词，面试官容易跟上你的思路。');

    /* 岗位相关性 */
    var kws = (job.keywords || []);
    var kwHits = kws.filter(function (k) { return containsSkill(text, k); });
    var relevance = Math.min(100, 30 + (kws.length ? kwHits.length / kws.length : 0.3) * 60 + (kwHits.length >= 2 ? 10 : 0));
    dims.relevance = relevance;
    if (kwHits.length) feedback.push('命中岗位关键词：' + kwHits.slice(0, 4).join('、') + '。可以再主动把结论往岗位职责上靠。');
    else feedback.push('回答中没有出现岗位 JD 关注的能力关键词（' + kws.slice(0, 3).join('、') + '），面试官可能认为你对该岗位理解不足。');

    /* 证据充分性 */
    var metricHits = (text.match(/\d+\s*(%|个百分点|倍|万|千|人|条|个|次|小时|天|元)/g) || []).length;
    var ownership = /我(负责|主导|推动|设计|搭建|独立|牵头|提出)/.test(text) ? 1 : 0;
    var evidence = Math.min(100, 28 + metricHits * 18 + ownership * 16 + Math.min(16, Math.round(len / 30)));
    dims.evidence = evidence;
    if (!metricHits) feedback.push('缺少可验证的数据。哪怕补充一个「调研 30 位用户 / 转化率从 8% 提升到 11%」也会显著增强说服力。');
    else feedback.push('包含 ' + metricHits + ' 处量化信息，证据链较完整。');
    if (!ownership) feedback.push('较少使用第一人称说明个人贡献，容易被误认为你只是参与者。');

    /* 表达清晰度 */
    var sentences = text.split(/[。！？!?\n]/).filter(function (s) { return s.trim().length; });
    var avg = sentences.length ? len / sentences.length : len;
    var filler = (text.match(/那个|然后然后|就是说|额|emmm|其实吧/g) || []).length;
    var clarity = 100 - Math.max(0, avg - 60) * 0.5 - filler * 8;
    clarity = Math.max(35, Math.min(100, clarity));
    dims.clarity = clarity;
    if (avg > 60) feedback.push('单句偏长（平均 ' + Math.round(avg) + ' 字），口述时建议拆成短句，一句一个信息点。');
    if (filler) feedback.push('出现了 ' + filler + ' 处口语填充词，模拟面试时可以刻意减少。');
    if (len < 60) feedback.push('回答整体过短（' + len + ' 字），建议补充到 200-300 字再口述练习。');

    var total = Math.round(dims.structure * 0.3 + dims.relevance * 0.3 + dims.evidence * 0.25 + dims.clarity * 0.15);

    /* 追问 */
    var followUps = [];
    if (/项目|需求/.test(question.text)) followUps.push('那在这个过程中，有没有哪一个需求是你主动放弃的？为什么？');
    if (metricHits) followUps.push('这个数据是怎么统计出来的？口径是什么？');
    else followUps.push('如果要用一个数字说明这个项目的价值，你会选哪个指标？');
    followUps.push('如果给你三倍资源，你还会优先解决这个问题吗？');

    return { score: total, dimensions: dims, feedback: feedback, followUps: followUps, answeredAt: new Date().toISOString() };
  }

  /* ========================= 5. 秋招日报 ========================= */

  function dailyReport(jobs, profile, resume) {
    var scored = jobs.filter(function (j) { return j.status !== 'closed'; }).map(function (j) {
      var m = matchJob(j, profile, resume);
      return { job: j, match: m };
    });
    scored.sort(function (a, b) { return b.match.score - a.match.score; });

    var high = scored.filter(function (s) { return s.match.score >= (D.META.highMatchThreshold || 72); });
    var upcoming = jobs.filter(function (j) {
      if (!j.deadline || j.deadline === '待官方确认') return false;
      var d = new Date(j.deadline.replace(/\./g, '-'));
      if (isNaN(d)) return false;
      var today = new Date(D.META.today);
      var diff = (d - today) / 86400000;
      return diff >= 0 && diff <= 14;
    }).sort(function (a, b) { return new Date(a.deadline) - new Date(b.deadline); });

    return {
      date: D.META.today,
      newJobs: jobs.length,
      highMatch: high.length,
      deadlines: upcoming.length,
      upcoming: upcoming,
      topPicks: scored.slice(0, 4),
      recommended: scored[0] || null
    };
  }

  /* ====================== 远程大模型（可选通道） ====================== */

  function callRemote(messages, settings) {
    if (!settings || !settings.apiKey || !settings.endpoint) {
      return Promise.reject(new Error('未配置模型接口'));
    }
    return fetch(settings.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + settings.apiKey
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-4o-mini',
        messages: messages,
        temperature: 0.4
      })
    }).then(function (r) {
      if (!r.ok) throw new Error('模型接口返回 ' + r.status);
      return r.json();
    }).then(function (json) {
      var content = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
      if (!content) throw new Error('模型返回为空');
      return content;
    });
  }

  window.AIEngine = {
    parseJob: parseJob,
    matchJob: matchJob,
    tailorResume: tailorResume,
    generateQuestions: generateQuestions,
    buildAnswer: buildAnswer,
    evaluateAnswer: evaluateAnswer,
    dailyReport: dailyReport,
    callRemote: callRemote,
    findEvidence: findEvidence,
    detectSkillsIn: detectSkillsIn,
    containsSkill: containsSkill,
    uniq: uniq
  };
})(window);
