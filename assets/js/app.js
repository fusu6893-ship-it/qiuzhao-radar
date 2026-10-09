/* ------------------------------------------------------------------
 * app.js — 极简路由 + 全局交互 + 首次使用引导
 * ---------------------------------------------------------------- */
(function (window) {
  'use strict';

  var D = window.AIData;
  var E = window.AIEngine;
  var S = window.Store;
  var V = window.Views;
  var UI = window.UI;
  var esc = UI.esc;

  var viewEl = document.getElementById('view');
  var currentRoute = null;

  /* ============================ 路由 ============================ */

  function parseHash() {
    var h = (window.location.hash || '').replace(/^#\/?/, '');
    return h.split('/').filter(Boolean);
  }

  function resolve(parts) {
    var p0 = parts[0] || 'dashboard';
    if (p0 === 'dashboard') return { fn: V.dashboard, params: {} };
    if (p0 === 'radar') return { fn: V.radar, params: {} };
    if (p0 === 'job') return { fn: V.job, params: { id: parts[1] } };
    if (p0 === 'resume') {
      if (parts[1] === 'new') return { fn: V.resumeNew, params: { jobId: parts[2] } };
      if (parts[1] === 'v') return { fn: V.resumeVersion, params: { versionId: parts[2] } };
      return { fn: V.resume, params: {} };
    }
    if (p0 === 'interview') {
      if (parts[1]) V._setInterviewJob(parts[1]);
      return { fn: V.interview, params: {} };
    }
    if (p0 === 'progress') return { fn: V.progress, params: {} };
    if (p0 === 'profile') return { fn: V.profile, params: {} };
    if (p0 === 'settings') return { fn: V.settings, params: {} };
    return { fn: V.dashboard, params: {} };
  }

  function render() {
    var parts = parseHash();
    currentRoute = parts;
    var r = resolve(parts);
    var out;
    try {
      out = r.fn(r.params);
    } catch (err) {
      console.error(err);
      out = { html: '<div class="card empty"><b>页面渲染出错</b><div class="small mt-8">' + esc(err.message) + '</div>' +
        '<div class="mt-16"><a class="btn btn-sm" href="#/dashboard">返回工作台</a></div></div>', mount: function () {} };
    }
    viewEl.innerHTML = out.html || '';
    if (out.mount) out.mount(viewEl);
    updateNav(parts[0] || 'dashboard');
    updateCounts();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function updateNav(active) {
    var map = { dashboard: 'dashboard', radar: 'radar', job: 'radar', resume: 'resume',
      'resumeNew': 'resume', interview: 'interview', progress: 'progress', profile: 'profile', settings: 'settings' };
    document.querySelectorAll('#nav-main .nav-item, #nav-account .nav-item').forEach(function (el) {
      var v = el.getAttribute('data-view');
      el.classList.toggle('active', v === (map[active] || active));
    });
  }

  function updateCounts() {
    var st = S.stats();
    setText('nav-count-jobs', st.newJobs);
    setText('nav-count-tasks', st.tasks);
    var avatar = document.getElementById('avatar');
    if (avatar) avatar.textContent = (S.state.profile.name || '我').slice(0, 1);
  }

  function setText(id, v) {
    var el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  /* ============================ 全局动作 ============================ */

  var ACTIONS = {
    goto: function (el) {
      var v = el.getAttribute('data-view');
      var id = el.getAttribute('data-id');
      if (v === 'job') window.location.hash = '#/job/' + id;
      else window.location.hash = '#/' + v;
    },
    gotoRaw: function (el) { window.location.hash = el.getAttribute('data-href'); },

    fav: function (el) {
      var id = el.getAttribute('data-id');
      var added = S.toggleFavorite(id);
      var j = S.jobById(id);
      UI.toast(added ? '已收藏「' + j.title + '」，可在进度中心统一管理' : '已取消收藏', added ? 'ok' : 'warn');
      render();
    },

    tailor: function (el) { window.location.hash = '#/resume/new/' + el.getAttribute('data-id'); },
    'tailor-now': function (el) { window.location.hash = '#/resume/new/' + el.getAttribute('data-id'); },

    'interview-for': function (el) {
      var id = el.getAttribute('data-id');
      V._setInterviewJob(id);
      window.location.hash = '#/interview';
      render();
      var job = S.jobById(id);
      if (!S.state.interviewPlans[id]) {
        setTimeout(function () { generateQuestions(id); }, 260);
      } else {
        UI.toast('已载入「' + job.title + '」的面试准备', 'ok');
      }
    },

    'confirm-apply': function (el) {
      var id = el.getAttribute('data-id');
      var job = S.jobById(id);
      var hasVersion = S.state.resumeVersions.some(function (v) { return v.jobId === id; });
      UI.modal({
        title: '确认投递「' + job.company + ' · ' + job.title + '」？',
        body: '<div class="small" style="color:var(--text-2);line-height:1.8">' +
          '产品不会自动替你投递。确认后，该岗位会加入进度中心并记录投递时间与来源，方便后续跟进。<br><br>' +
          '<b>当前定制简历：</b>' + (hasVersion ? '已生成 ✓' : '尚未生成') + '<br>' +
          '<b>信息边界：</b>企业招聘状态以官方页面为准，产品不会替你向任何企业发送申请。' +
          '</div>',
        actions: [
          { label: '稍后再说', cls: 'btn-ghost', onClick: function (m, close) { close(); } },
          { label: '生成定制简历', onClick: function (m, close) { close(); window.location.hash = '#/resume/new/' + id; } },
          { label: '确认已投递', cls: 'btn-primary', onClick: function (m, close) {
            close();
            S.setStage(id, 'applied');
            S.addTask({ title: '跟进「' + job.company + ' · ' + job.title + '」投递结果', jobId: id, due: '', priority: 'medium', type: '跟进' });
            UI.toast('已加入进度中心，并创建一条跟进待办', 'ok');
            render();
          } }
        ]
      });
    },

    'save-stage': function (el) {
      var id = el.getAttribute('data-id');
      var sel = document.getElementById('stageSelect');
      var note = document.getElementById('appNote');
      S.setStage(id, sel.value, note ? note.value : '');
      UI.toast('进度已保存', 'ok');
      render();
    },

    'gen-questions': function (el) { generateQuestions(el.getAttribute('data-id')); },

    'submit-answer': function (el) {
      var qid = el.getAttribute('data-q');
      var input = document.getElementById('answerInput');
      var text = input ? input.value.trim() : '';
      if (!text) { UI.toast('请先输入你的回答，哪怕只是要点', 'warn'); return; }
      var jobId = V._interviewState.jobId;
      var plan = S.state.interviewPlans[jobId];
      var q = null;
      plan.groups.forEach(function (g) { g.questions.forEach(function (x) { if (x.id === qid) q = x; }); });
      var job = S.jobById(jobId);
      var feedback = E.evaluateAnswer(text, q, job);
      V._interviewState.feedback = { questionId: qid, feedback: feedback, answer: text };
      S.addSession({ jobId: jobId, question: q, answer: text, feedback: feedback });
      UI.toast('已生成反馈：综合 ' + feedback.score + ' 分', feedback.score >= 75 ? 'ok' : 'warn');
      render();
    },

    'retry-answer': function () {
      V._interviewState.feedback = null;
      V._interviewState.answer = '';
      render();
    },

    'bind-apply': function (el) {
      var ver = S.versionById(el.getAttribute('data-id'));
      if (!ver) return;
      ver.applied = true;
      S.setStage(ver.jobId, 'applied');
      S.save();
      UI.toast('已绑定到该岗位并标记为已投递', 'ok');
      render();
    },

    'export-md': function (el) {
      var ver = S.versionById(el.getAttribute('data-id'));
      var md = V._export.versionToMarkdown(ver);
      var job = S.jobById(ver.jobId);
      download((job ? job.company + '-' + job.title : 'resume') + '-定制简历.md', md, 'text/markdown');
      UI.toast('已导出 Markdown 文件', 'ok');
    },

    print: function () {
      UI.toast('已打开打印窗口，选择「另存为 PDF」即可导出', 'ok');
      setTimeout(function () { window.print(); }, 320);
    },

    'import-job': openImportModal,
    'radar-reset': function () {
      var r = V._radarState;
      r.q = ''; r.city = 'all'; r.direction = 'all'; r.degree = 'all';
      r.source = 'all'; r.status = 'all'; r.onlyFav = false; r.minMatch = 0;
      var si = document.getElementById('global-search');
      if (si) si.value = '';
      render();
    },

    'clear-search': function () {
      V._radarState.q = '';
      var si = document.getElementById('global-search');
      if (si) si.value = '';
      render();
    },

    'toggle-add-task': function () {
      var ps = V._progressState || {};
      ps.showAddTask = !ps.showAddTask;
      V._progressState = ps;
      render();
    },

    'del-task': function (el) { S.removeTask(el.getAttribute('data-id')); render(); },

    'export-state': function () {
      download('秋招雷达-数据备份-' + D.META.today + '.json', JSON.stringify(S.state, null, 2), 'application/json');
      UI.toast('已导出全部数据', 'ok');
    },

    'import-state': function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', function () {
        var f = input.files[0];
        if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          try {
            var data = JSON.parse(fr.result);
            Object.keys(data).forEach(function (k) { S.state[k] = data[k]; });
            S.save();
            UI.toast('数据导入成功', 'ok');
            render();
          } catch (e) { UI.toast('文件解析失败：' + e.message, 'warn'); }
        };
        fr.readAsText(f);
      });
      input.click();
    },

    'reset-state': function () {
      UI.confirm({
        title: '恢复示例数据？',
        body: '当前浏览器中保存的个人画像、投递记录、简历定制版本与面试练习记录都会被清除，并恢复为初始示例数据。<br><br>该操作不可撤销。',
        danger: true, okLabel: '确认清除',
        onOk: function () {
          S.reset();
          UI.toast('已恢复示例数据', 'warn');
          window.location.hash = '#/dashboard';
          render();
          if (!S.state.onboarded) showOnboarding();
        }
      });
    },

    'save-settings': function () {
      S.updateSettings({
        useRemote: document.getElementById('useRemote').checked,
        endpoint: document.getElementById('sEndpoint').value.trim(),
        apiKey: document.getElementById('sKey').value.trim(),
        model: document.getElementById('sModel').value.trim()
      });
      UI.toast('配置已保存到本地', 'ok');
    },

    'test-model': function () {
      var endpoint = document.getElementById('sEndpoint').value.trim();
      var apiKey = document.getElementById('sKey').value.trim();
      if (!endpoint || !apiKey) { UI.toast('请先填写接口地址与 API Key', 'warn'); return; }
      UI.toast('正在测试连接…');
      E.callRemote([{ role: 'user', content: '回复"连接成功"四个字。' }],
        { endpoint: endpoint, apiKey: apiKey, model: document.getElementById('sModel').value.trim() })
        .then(function (content) { UI.toast('连接成功：' + content.slice(0, 30), 'ok'); })
        .catch(function (err) { UI.toast('连接失败：' + err.message + '（将自动回退本地引擎）', 'warn'); });
    },

    'save-profile': saveProfile,
    'add-project': function () { addResumeItem('project'); },
    'add-internship': function () { addResumeItem('internship'); },
    'del-project': function (el) {
      var idx = Number(el.getAttribute('data-idx'));
      S.state.resume.projects.splice(idx, 1);
      S.save();
      render();
    },

    'upload-resume': openUploadModal
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    if (ACTIONS[act]) {
      e.preventDefault();
      ACTIONS[act](el, e);
    }
  });

  /* ============================ 生成面试题 ============================ */

  function generateQuestions(jobId) {
    var job = S.jobById(jobId);
    if (!job) return;
    UI.toast('AI 正在整合面经、岗位 JD 与你的项目经历…');
    setTimeout(function () {
      var plan = E.generateQuestions(job, S.state.profile, S.state.resume, D.INTERVIEW_REPORTS);
      S.setInterviewPlan(jobId, plan);
      if (S.stageOf(jobId) === 'applied' || S.stageOf(jobId) === 'written') S.setStage(jobId, 'interview', '进入面试准备模式');
      UI.toast('已生成 ' + plan.total + ' 道面试题', 'ok');
      if ((window.location.hash || '').indexOf('/interview') === -1) window.location.hash = '#/interview';
      else render();
    }, 700);
  }

  /* ============================ 导入岗位 ============================ */

  function openImportModal() {
    UI.modal({
      title: '手动导入招聘链接或岗位文本',
      wide: true,
      body: '<div class="notice info mb-16">' + UI.icon('info') +
          '<div>对于不支持自动采集的公众号或小红书内容，可以粘贴链接与文本，由 AI 解析为结构化岗位卡片。<b>解析结果需要你人工核对。</b></div></div>' +
        '<div class="field"><label>来源渠道</label>' +
          '<select class="select" id="impChannel">' +
            ['企业招聘官网', '微信公众号', '小红书', '校园招聘平台', '其他'].map(function (c) { return '<option>' + c + '</option>'; }).join('') +
          '</select></div>' +
        '<div class="field"><label>原文链接（可选）</label>' +
          '<input class="input" id="impUrl" placeholder="https://…"></div>' +
        '<div class="field"><label>招聘文本</label>' +
          '<textarea class="textarea" id="impText" style="min-height:220px" placeholder="把岗位名称、公司、岗位职责、任职要求等文本直接粘贴到这里，AI 会自动抽取字段。"></textarea></div>' +
        '<div class="row"><button class="btn btn-sm" data-act="fill-sample">填入一段示例文本</button>' +
          '<span class="tiny muted">示例数据仅用于演示解析效果。</span></div>',
      actions: [
        { label: '取消', cls: 'btn-ghost', onClick: function (m, close) { close(); } },
        { label: '解析并加入岗位库', cls: 'btn-primary', icon: 'spark', onClick: function (mask, close) {
          var text = mask.querySelector('#impText').value.trim();
          if (!text) { UI.toast('请先粘贴招聘文本', 'warn'); return; }
          var channel = mask.querySelector('#impChannel').value;
          var url = mask.querySelector('#impUrl').value.trim();
          var isOfficial = /官网|校园招聘平台/.test(channel);
          var job = E.parseJob(text, {
            sources: [{ channel: channel, url: url, publishedAt: D.META.today, verifiedAt: D.META.today }],
            channel: channel
          });
          job.sourceType = isOfficial ? 'official' : 'community';
          job.needsReview = true;
          close();
          S.addJob(job);
          UI.toast('已解析并加入岗位库，请核对字段', 'ok');
          window.location.hash = '#/job/' + job.id;
          render();
        } }
      ],
      onMount: function (mask) {
        var btn = mask.querySelector('[data-act="fill-sample"]');
        if (btn) btn.addEventListener('click', function () {
          mask.querySelector('#impText').value =
            '星野科技 2027 届校园招聘\n' +
            '岗位名称：内容策略产品经理\n' +
            '工作城市：北京 / 上海\n' +
            '学历要求：本科及以上\n' +
            '岗位职责\n' +
            '1. 负责内容分发策略的需求调研、方案设计与上线跟进；\n' +
            '2. 通过数据分析与用户访谈定位内容生态问题并推动迭代。\n' +
            '任职要求\n' +
            '1. 具备较强的需求分析与用户调研能力，能独立输出 PRD 与原型；\n' +
            '2. 熟悉 SQL，具备数据驱动决策的意识和 A/B 测试经验优先；\n' +
            '3. 对内容社区有深入理解，有相关项目或实习经历优先。\n' +
            '投递截止时间：2026 年 10 月 27 日';
          UI.toast('已填入示例文本，可直接点击解析');
        });
      }
    });
  }

  /* ============================ 简历上传 / 粘贴 ============================ */

  function openUploadModal() {
    UI.modal({
      title: '上传或粘贴你的简历',
      wide: true,
      body: '<div class="notice info mb-16">' + UI.icon('info') +
          '<div>支持粘贴文本或上传 <b>.txt / .md</b> 文件（可在 Word 中复制为纯文本后粘贴）。AI 会尝试识别教育、实习、项目与技能段落。</div></div>' +
        '<div class="row mb-16"><input type="file" id="resumeFile" accept=".txt,.md,.markdown,.json" class="input">' +
        '<button class="btn btn-sm" data-act="use-sample-resume">使用示例简历</button></div>' +
        '<div class="field"><label>简历文本</label>' +
        '<textarea class="textarea" id="resumeText" style="min-height:240px" placeholder="姓名：张三\n教育经历：\n2025.09-2027.06 示例大学 硕士 信息管理\n实习经历：\n2026.03-2026.08 某某公司 产品实习生\n- 参与……\n项目经历：\n- …">' +
        '</textarea></div>',
      actions: [
        { label: '取消', cls: 'btn-ghost', onClick: function (m, close) { close(); } },
        { label: '解析并保存到简历库', cls: 'btn-primary', onClick: function (mask, close) {
          var text = mask.querySelector('#resumeText').value.trim();
          if (!text) { UI.toast('请先粘贴简历文本', 'warn'); return; }
          close();
          applyParsedResume(text);
        } }
      ],
      onMount: function (mask, close) {
        var file = mask.querySelector('#resumeFile');
        file.addEventListener('change', function () {
          var f = file.files[0];
          if (!f) return;
          var fr = new FileReader();
          fr.onload = function () { mask.querySelector('#resumeText').value = fr.result; UI.toast('已读取文件内容，点击解析即可'); };
          fr.readAsText(f);
        });
        mask.querySelector('[data-act="use-sample-resume"]').addEventListener('click', function () {
          mask.querySelector('#resumeText').value = SAMPLE_RESUME_TEXT;
          UI.toast('已载入示例简历文本');
        });
      }
    });
  }

  var SAMPLE_RESUME_TEXT = [
    '姓名：林知遥',
    '学历：硕士　专业：信息管理与信息系统　毕业时间：2027.06',
    '教育经历',
    '2025.09-2027.06 示例大学 硕士 信息管理与信息系统',
    '2021.09-2025.06 示例理工大学 本科 电子商务',
    '实习经历',
    '2026.03-2026.08 拾光互娱 产品运营实习生',
    '- 参与社区内容板块的日常运营，整理用户反馈并输出周报。',
    '项目经历',
    '2025.10-2026.01 校园二手交易平台 产品负责人',
    '- 参与校园二手交易平台项目，负责部分需求调研和功能设计。',
    '- 设计了商品发布和搜索页面的原型。',
    '技能',
    'Figma、Axure、SQL、Python 基础、Excel、Tableau、用户调研、原型设计'
  ].join('\n');

  function applyParsedResume(text) {
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var r = JSON.parse(JSON.stringify(S.state.resume));
    var section = null;
    var edu = [], ints = [], projs = [], skills = [];
    var current = null;

    function flush() {
      if (!current) return;
      if (section === 'edu') edu.push(current);
      if (section === 'int') ints.push(current);
      if (section === 'proj') projs.push(current);
      current = null;
    }

    lines.forEach(function (line) {
      var l = line.replace(/^[#*\-•\s]+/, '');
      if (/^教育/.test(l)) { flush(); section = 'edu'; return; }
      if (/^实习|^工作经历/.test(l)) { flush(); section = 'int'; return; }
      if (/^项目/.test(l)) { flush(); section = 'proj'; return; }
      if (/^技能/.test(l)) { flush(); section = null; skills = line.split(/[:：]/).slice(1).join('').split(/[，,、\/|]/).map(function (s) { return s.trim(); }).filter(Boolean); return; }
      if (/^姓名/.test(l)) { var m = l.split(/[:：]/)[1]; if (m) r.basics.name = m.trim(); return; }
      if (/^学历|^专业|^毕业/.test(l) || /硕士|本科|毕业时间/.test(l) && !section) {
        if (/2027|2026|2025|2028/.test(l)) r.basics.headline = l;
        return;
      }

      if (!section) return;
      var isBullet = /^[-•·]/.test(line) || /^[0-9]+[.、]/.test(line);
      if (section === 'edu') {
        var per = (l.match(/(\d{4}[.\-/]\d{1,2}\s*[-~至]\s*\d{4}[.\-/]\d{1,2})/) || [''])[0];
        var rest = l.replace(per, '').trim();
        var parts = rest.split(/\s+/);
        current = { id: 'edu-' + Date.now() + edu.length, school: parts[0] || rest, degree: parts.slice(1).join(' ') || '', period: per, detail: '' };
      } else if (section === 'int' || section === 'proj') {
        if (isBullet && current) {
          current.bullets.push(l);
        } else {
          flush();
          var per2 = (l.match(/(\d{4}[.\-/]\d{1,2}\s*[-~至]\s*\d{4}[.\-/]\d{1,2})/) || [''])[0];
          var rest2 = l.replace(per2, '').trim();
          var seg = rest2.split(/\s+/);
          if (section === 'int') current = { id: 'int-' + Date.now() + ints.length, company: seg[0] || rest2, role: seg.slice(1).join(' ') || '', period: per2, bullets: [] };
          else current = { id: 'proj-' + Date.now() + projs.length, name: seg[0] || rest2, role: seg.slice(1).join(' ') || '', period: per2, bullets: [] };
        }
      }
    });
    flush();

    if (edu.length) r.education = edu;
    if (ints.length) r.internships = ints.map(function (x) { return { id: x.id, company: x.company, role: x.role, period: x.period, bullets: x.bullets.length ? x.bullets : [''] }; });
    if (projs.length) r.projects = projs.map(function (x) { return { id: x.id, name: x.name, role: x.role, period: x.period, bullets: x.bullets.length ? x.bullets : [''] }; });
    if (skills.length) r.skills = skills;

    S.updateResume(r);
    UI.toast('简历已解析并保存（教育 ' + r.education.length + ' 项 / 实习 ' + r.internships.length + ' 段 / 项目 ' + r.projects.length + ' 个）', 'ok');
    window.location.hash = '#/profile';
    render();
  }

  function addResumeItem(kind) {
    var r = S.state.resume;
    if (kind === 'project') {
      r.projects = r.projects || [];
      r.projects.push({ id: 'proj-' + Date.now(), name: '新项目名称', role: '你的角色', period: '', bullets: ['描述你在这个项目里具体做了什么。'] });
    } else {
      r.internships = r.internships || [];
      r.internships.push({ id: 'int-' + Date.now(), company: '公司名称', role: '岗位', period: '', bullets: ['描述你的工作内容。'] });
    }
    S.save();
    render();
    UI.toast('已添加，请填写真实内容后保存');
  }

  function saveProfile() {
    var root = viewEl;
    var chips = function (name) {
      var box = root.querySelector('[data-profile-chips="' + name + '"]');
      if (!box) return [];
      return Array.prototype.slice.call(box.querySelectorAll('.chip.on')).map(function (c) { return c.getAttribute('data-val'); });
    };
    var val = function (id, fallback) { var el = root.querySelector('#' + id); return el ? el.value.trim() : fallback; };

    S.updateProfile({
      name: val('pName', S.state.profile.name),
      school: val('pSchool', ''),
      degree: val('pDegree', '硕士'),
      gradYear: val('pGrad', ''),
      major: val('pMajor', ''),
      cities: chips('cities'),
      directions: chips('directions'),
      salaryExpect: val('pSalary', ''),
      priority: val('pPriority', ''),
      targetCompanies: val('pCompanies', '').split(/[、,，]/).map(function (s) { return s.trim(); }).filter(Boolean)
    });
    S.setOnboarded(true);

    /* 简历：headline / 项目 / 实习 / 技能 */
    var r = JSON.parse(JSON.stringify(S.state.resume));
    r.basics.headline = val('rHeadline', r.basics.headline);
    root.querySelectorAll('[data-proj]').forEach(function (el) {
      var parts = el.getAttribute('data-proj').split('-');
      var i = Number(parts[0]);
      if (!r.projects[i]) return;
      var key = parts.slice(1).join('-');
      if (key === 'name') r.projects[i].name = el.value;
      else if (key === 'role') r.projects[i].role = el.value;
      else if (/^b\d+$/.test(key)) {
        r.projects[i].bullets = r.projects[i].bullets || [];
        r.projects[i].bullets[Number(key.slice(1))] = el.value;
      }
    });
    root.querySelectorAll('[data-int]').forEach(function (el) {
      var parts = el.getAttribute('data-int').split('-');
      var i = Number(parts[0]);
      if (!r.internships[i]) return;
      var key = parts.slice(1).join('-');
      if (key === 'company') r.internships[i].company = el.value;
      else if (key === 'b0') r.internships[i].bullets = [el.value];
    });
    var skillsEl = root.querySelector('#rSkills');
    if (skillsEl) r.skills = skillsEl.value.split(/[，,、\/|]/).map(function (s) { return s.trim(); }).filter(Boolean);
    var awardsEl = root.querySelector('#rAwards');
    if (awardsEl) r.awards = awardsEl.value.split(/[，,、\/|]/).map(function (s) { return s.trim(); }).filter(Boolean);
    S.updateResume(r);

    UI.toast('画像与简历已保存，岗位匹配结果已同步更新', 'ok');
    render();
  }

  /* ============================ 首次使用引导 ============================ */

  var onboardStep = 0;
  var onboardDraft = {};

  function showOnboarding() {
    var root = document.createElement('div');
    root.className = 'onboard';
    root.id = 'onboard';
    document.body.appendChild(root);
    onboardStep = 0;
    onboardDraft = {
      directions: (S.state.profile.directions || []).slice(),
      cities: (S.state.profile.cities || []).slice(),
      degree: S.state.profile.degree
    };
    paintOnboarding(root);
  }

  function paintOnboarding(root) {
    var help = [
      { t: '你的求职偏好', d: '这些信息决定了「岗位匹配」和「秋招日报」如何为你筛选，随时可以在个人画像中修改。' },
      { t: '你的简历素材', d: 'AI 定制简历和面试回答都只基于你的真实经历生成，不会编造数据与成果。' },
      { t: '准备开始', d: '接下来你会看到一条完整链路：发现机会 → 判断匹配 → 定制简历 → 准备面试 → 跟踪结果。' }
    ];
    var body = '';

    if (onboardStep === 0) {
      body = '<div class="field"><label>目标岗位方向（可多选）</label><div class="opt-grid">' +
        [['产品', '产品经理 / 策略 / 增长'], ['数据', '数据产品 / 数据分析'], ['运营', '产品运营 / 内容运营'],
         ['设计', '交互 / 视觉设计'], ['技术', '研发 / 算法']].map(function (d) {
          var on = onboardDraft.directions.indexOf(d[0]) !== -1;
          return '<div class="opt' + (on ? ' on' : '') + '" data-opt="directions" data-val="' + d[0] + '"><b>' + d[0] + '</b><span>' + d[1] + '</span></div>';
        }).join('') + '</div></div>' +
        '<div class="field"><label>目标城市（可多选）</label><div class="opt-grid">' +
        ['北京', '上海', '深圳', '广州', '杭州', '成都'].map(function (c) {
          var on = onboardDraft.cities.indexOf(c) !== -1;
          return '<div class="opt' + (on ? ' on' : '') + '" data-opt="cities" data-val="' + c + '"><b>' + c + '</b><span>工作城市</span></div>';
        }).join('') + '</div></div>' +
        '<div class="field"><label>当前学历</label><div class="opt-grid" style="grid-template-columns:repeat(4,1fr)">' +
        ['本科', '硕士', '博士', '大专'].map(function (d) {
          return '<div class="opt' + (onboardDraft.degree === d ? ' on' : '') + '" data-opt="degree" data-val="' + d + '"><b>' + d + '</b><span>学历</span></div>';
        }).join('') + '</div></div>';
    } else if (onboardStep === 1) {
      body = '<div class="notice info mb-16">' + UI.icon('info') +
        '<div>可以直接使用示例简历体验完整流程，也可以粘贴自己的简历文本。所有数据仅保存在你的浏览器本地。</div></div>' +
        '<div class="row row-wrap"><button class="btn" data-ob="sample">使用示例简历</button>' +
        '<button class="btn btn-primary" data-ob="upload">' + UI.icon('upload') + '粘贴 / 上传我的简历</button></div>' +
        '<div class="card card-pad mt-16" style="background:var(--surface-2);box-shadow:none">' +
        '<div class="small strong">当前简历</div>' +
        '<div class="small muted mt-8">' + esc(S.state.resume.basics.name) + ' · ' + esc(S.state.resume.basics.headline) + '</div>' +
        '<div class="tiny muted">' + (S.state.resume.education || []).length + ' 段教育 · ' +
          (S.state.resume.internships || []).length + ' 段实习 · ' + (S.state.resume.projects || []).length + ' 个项目</div></div>';
    } else {
      body = '<div class="grid grid-3" style="gap:12px">' +
        [['① 招聘雷达', '多渠道信息聚合、每日更新、来源可追溯'], ['② 智能匹配', '匹配优势 / 能力差距 / 下一步建议'],
         ['③ AI 简历工坊', 'JD 解析、经历重写、逐条确认、导出 PDF'], ['④ AI 面试教练', '面经整合、预测问题、模拟面试反馈'],
         ['⑤ 进度中心', '投递看板、待办提醒、结构分析']].map(function (x) {
          return '<div class="opt" style="cursor:default"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>';
        }).join('') + '</div>' +
        '<div class="notice mt-16">' + UI.icon('shield') +
        '<div><b>合规提示：</b>本产品使用虚构示例数据演示产品能力，不抓取任何未授权内容，也不会替你自动投递。</div></div>';
    }

    root.innerHTML = '<div class="onboard-inner">' +
      '<div class="row mb-16"><div class="brand-mark">秋</div>' +
        '<div><b style="font-size:16px">欢迎使用秋招雷达</b><div class="tiny muted">AI 求职工作台 · 首次使用引导</div></div>' +
        '<span class="spacer" style="flex:1"></span>' +
        '<button class="btn btn-sm btn-ghost" data-ob="skip">跳过，直接体验示例数据</button></div>' +
      '<div class="steps">' + [0, 1, 2].map(function (i) { return '<div class="step-bar' + (i <= onboardStep ? ' on' : '') + '"></div>'; }).join('') + '</div>' +
      '<div class="card card-pad">' +
        '<div class="tiny muted">第 ' + (onboardStep + 1) + ' / 3 步</div>' +
        '<h2 style="margin:6px 0 6px;font-size:20px">' + help[onboardStep].t + '</h2>' +
        '<p class="muted small mb-16">' + help[onboardStep].d + '</p>' +
        body +
        '<div class="row mt-24"><span class="spacer" style="flex:1"></span>' +
          (onboardStep > 0 ? '<button class="btn" data-ob="back">上一步</button>' : '') +
          '<button class="btn btn-primary" data-ob="next">' + (onboardStep === 2 ? '进入工作台' : '下一步') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="tiny muted mt-16" style="text-align:center">示例数据来自公开产品设计案例，公司名称为虚构，仅用于演示。</div>' +
    '</div>';

    root.querySelectorAll('[data-opt]').forEach(function (opt) {
      opt.addEventListener('click', function () {
        var group = opt.getAttribute('data-opt');
        var v = opt.getAttribute('data-val');
        if (group === 'degree') { onboardDraft.degree = v; }
        else {
          var arr = onboardDraft[group];
          var i = arr.indexOf(v);
          if (i === -1) arr.push(v); else arr.splice(i, 1);
        }
        paintOnboarding(root);
      });
    });
    root.querySelectorAll('[data-ob]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var a = btn.getAttribute('data-ob');
        if (a === 'skip') { finishOnboarding(root, true); return; }
        if (a === 'back') { onboardStep = Math.max(0, onboardStep - 1); paintOnboarding(root); return; }
        if (a === 'sample') { UI.toast('已使用示例简历，你也可以随时在个人画像中替换'); onboardStep = 2; paintOnboarding(root); return; }
        if (a === 'upload') {
          document.body.removeChild(root);
          openUploadModal();
          return;
        }
        if (a === 'next') {
          if (onboardStep === 0 && !onboardDraft.directions.length) { UI.toast('请至少选择一个岗位方向', 'warn'); return; }
          if (onboardStep < 2) { onboardStep += 1; paintOnboarding(root); }
          else finishOnboarding(root, false);
        }
      });
    });
  }

  function finishOnboarding(root, skipped) {
    S.updateProfile({
      directions: onboardDraft.directions && onboardDraft.directions.length ? onboardDraft.directions : S.state.profile.directions,
      cities: onboardDraft.cities && onboardDraft.cities.length ? onboardDraft.cities : S.state.profile.cities,
      degree: onboardDraft.degree || S.state.profile.degree
    });
    S.setOnboarded(true);
    if (root && root.parentNode) root.parentNode.removeChild(root);
    UI.toast(skipped ? '已跳过引导，正在使用示例数据' : '画像已建立，已按你的偏好重新计算岗位匹配', 'ok');
    window.location.hash = '#/dashboard';
    render();
  }

  /* ============================ 工具 ============================ */

  function download(filename, content, type) {
    var blob = new Blob([content], { type: (type || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }

  /* 顶部搜索 */
  var searchInput = document.getElementById('global-search');
  var searchTimer = null;

  function doSearch(opts) {
    var q = searchInput.value.trim();
    V._radarState.q = q;
    if ((window.location.hash || '').indexOf('/radar') === -1) window.location.hash = '#/radar';
    else render();
    if (q && !(opts && opts.silent)) UI.toast('已在招聘雷达中搜索「' + q + '」');
  }

  searchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
  searchInput.addEventListener('search', doSearch);
  /* 输入即搜（防抖），保证清空输入框时筛选条件也会同步重置 */
  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { doSearch({ silent: true }); }, 280);
  });

  document.getElementById('btn-import-top').addEventListener('click', openImportModal);
  document.getElementById('avatar').addEventListener('click', function () { window.location.hash = '#/profile'; });
  document.getElementById('btn-notice').addEventListener('click', function () {
    var st = S.stats();
    var open = S.state.tasks.filter(function (t) { return !t.done; });
    UI.modal({
      title: '提醒与待办',
      body: '<div class="grid grid-3 mb-16">' +
          '<div class="score-cell"><div class="v">' + st.deadlines + '</div><div class="k">待处理截止日期</div></div>' +
          '<div class="score-cell"><div class="v">' + st.interviewing + '</div><div class="k">面试进行中</div></div>' +
          '<div class="score-cell"><div class="v">' + st.tasks + '</div><div class="k">未完成待办</div></div></div>' +
        (open.length ? open.map(function (t) {
          return '<div class="row mb-12"><span class="badge badge-' + (t.priority === 'high' ? 'danger' : 'warn') + '">' +
            (t.priority === 'high' ? '高' : '中') + '</span><span class="small">' + esc(t.title) + '</span></div>';
        }).join('') : '<div class="small muted">暂无待办</div>'),
      actions: [{ label: '前往进度中心', cls: 'btn-primary', onClick: function (m, close) { close(); window.location.hash = '#/progress'; } }]
    });
  });

  /* 订阅状态变化：写入后刷新界面计数 */
  S.subscribe(function () { updateCounts(); });

  window.addEventListener('hashchange', render);

  /* ============================ 启动 ============================ */

  window.App = { render: render, rerender: render, openImportModal: openImportModal, openUploadModal: openUploadModal };

  /* 作品集内嵌演示模式：隐藏侧边栏与顶栏，只保留页面内容 */
  if (/[?&]embed/.test(window.location.search)) {
    document.body.classList.add('embed');
  }

  render();
  if (!S.state.onboarded) showOnboarding();

})(window);
