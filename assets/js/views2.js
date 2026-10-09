/* ------------------------------------------------------------------
 * views2.js — AI 简历工坊 / 面试教练 / 进度中心 / 个人画像 / 设置
 * ---------------------------------------------------------------- */
(function (window) {
  'use strict';

  var D = window.AIData;
  var E = window.AIEngine;
  var S = window.Store;
  var UI = window.UI;
  var V = window.Views;
  var H = V._helpers;
  var esc = H.esc;

  /* ==================================================================
   * 一、AI 简历工坊
   * ================================================================== */

  var resumeState = { jobId: null, editingChange: null };

  /* 应用「已接受 / 已修改」的变更，得到最终简历内容 + 需要高亮的文本 */
  function appliedVersion(version) {
    var r = JSON.parse(JSON.stringify(S.state.resume));
    var marks = [];
    var accepted = (version.changes || []).filter(function (c) {
      return c.status === 'accepted' || c.status === 'edited';
    });

    accepted.forEach(function (c) {
      if (c.section === '个人简介') { r.basics.headline = c.after; marks.push(c.after); }
    });

    accepted.forEach(function (c) {
      if (!c.structural) return;
      var order = String(c.after).replace(/^建议顺序[:：]\s*/, '').split('→').map(function (s) { return s.trim(); });
      var map = {};
      r.projects.forEach(function (p) { map[p.name] = p; });
      var next = order.map(function (n) { return map[n]; }).filter(Boolean);
      r.projects.forEach(function (p) { if (next.indexOf(p) === -1) next.push(p); });
      r.projects = next;
    });

    accepted.forEach(function (c) {
      if (c.bulletIndex === undefined || c.bulletIndex === null || c.structural) return;
      var list = null;
      if (c.section === '项目经历') list = r.projects;
      if (c.section === '实习经历') list = r.internships;
      if (!list) return;
      list.forEach(function (item) {
        var name = item.name || item.company || item.role || '';
        if (name !== c.itemName) return;
        item.bullets[c.bulletIndex] = c.after;
        marks.push(c.after);
      });
    });

    return { resume: r, marks: marks };
  }

  function renderSheet(resume, marks, opts) {
    var o = opts || {};
    function hl(text) {
      var t = esc(text);
      (marks || []).forEach(function (mk) {
        if (mk && text === mk) t = '<mark>' + esc(mk) + '</mark>';
      });
      return t;
    }
    var html = '<div class="resume-sheet" id="print-area">';
    html += '<h2>' + esc(resume.basics.name) + '</h2>';
    html += '<div class="rs-headline">' + hl(resume.basics.headline) + '</div>';
    html += '<div class="rs-contact">' + esc(resume.basics.phone) + ' · ' + esc(resume.basics.email) + ' · ' + esc(resume.basics.city) + '</div>';

    html += '<h3>教育经历</h3>';
    (resume.education || []).forEach(function (e) {
      html += '<div class="rs-item"><div class="rs-item-head">' + esc(e.school) + '<span>' + esc(e.period) + '</span></div>' +
        '<div>' + esc(e.degree) + '</div>' +
        (e.detail ? '<div class="muted tiny">' + esc(e.detail) + '</div>' : '') + '</div>';
    });

    if ((resume.internships || []).length) {
      html += '<h3>实习经历</h3>';
      resume.internships.forEach(function (it) {
        html += '<div class="rs-item"><div class="rs-item-head">' + esc(it.company) + ' · ' + esc(it.role) + '<span>' + esc(it.period) + '</span></div>' +
          '<ul>' + (it.bullets || []).map(function (b) { return '<li>' + hl(b) + '</li>'; }).join('') + '</ul></div>';
      });
    }

    if ((resume.projects || []).length) {
      html += '<h3>项目经历</h3>';
      resume.projects.forEach(function (p) {
        html += '<div class="rs-item"><div class="rs-item-head">' + esc(p.name) + ' · ' + esc(p.role) + '<span>' + esc(p.period) + '</span></div>' +
          '<ul>' + (p.bullets || []).map(function (b) { return '<li>' + hl(b) + '</li>'; }).join('') + '</ul></div>';
      });
    }

    if ((resume.skills || []).length) {
      html += '<h3>技能</h3><div class="rs-skills">' +
        resume.skills.map(function (s) { return '<span class="rs-skill">' + esc(s) + '</span>'; }).join('') + '</div>';
    }
    if ((resume.awards || []).length) {
      html += '<h3>荣誉奖项</h3><ul>' + resume.awards.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>';
    }
    html += '</div>';
    return html;
  }

  function versionToMarkdown(version) {
    var av = appliedVersion(version);
    var r = av.resume;
    var out = [];
    out.push('# ' + r.basics.name);
    out.push(r.basics.headline);
    out.push(r.basics.phone + ' · ' + r.basics.email + ' · ' + r.basics.city);
    out.push('\n## 教育经历');
    (r.education || []).forEach(function (e) { out.push('**' + e.school + '**　' + e.period + '　' + e.degree + (e.detail ? '\n' + e.detail : '')); });
    if ((r.internships || []).length) {
      out.push('\n## 实习经历');
      r.internships.forEach(function (it) {
        out.push('**' + it.company + ' · ' + it.role + '**　' + it.period);
        (it.bullets || []).forEach(function (b) { out.push('- ' + b); });
      });
    }
    if ((r.projects || []).length) {
      out.push('\n## 项目经历');
      r.projects.forEach(function (p) {
        out.push('**' + p.name + ' · ' + p.role + '**　' + p.period);
        (p.bullets || []).forEach(function (b) { out.push('- ' + b); });
      });
    }
    if ((r.skills || []).length) out.push('\n## 技能\n' + r.skills.join(' / '));
    if ((r.awards || []).length) out.push('\n## 荣誉奖项\n' + r.awards.map(function (a) { return '- ' + a; }).join('\n'));
    out.push('\n---\n本文件由「秋招雷达」根据岗位 JD 生成，内容基于本人真实经历修改，AI 未编造经历。生成时间：' + version.createdAt);
    return out.join('\n');
  }

  /* ---------------------- 简历工坊首页 ---------------------- */

  V.resume = function () {
    var jobs = S.state.jobs.slice().sort(function (a, b) {
      var fa = S.isFavorite(a.id) ? 0 : 1, fb = S.isFavorite(b.id) ? 0 : 1;
      return fa - fb;
    });
    if (!resumeState.jobId) resumeState.jobId = (S.state.favorites[0] || S.state.jobs[0].id);
    var job = S.jobById(resumeState.jobId) || jobs[0];
    var m = E.matchJob(job, S.state.profile, S.state.resume);

    var html = '' +
      '<div class="page-head-row mb-16">' +
        '<div class="page-head"><h1>AI 简历工坊</h1>' +
          '<p>解析岗位 JD → 读取你的原始简历 → 建立岗位与经历的对应关系 → 逐条生成可接受 / 可撤销的修改建议</p></div>' +
        '<div class="row"><button class="btn" data-act="upload-resume">' + UI.icon('upload') + '上传简历</button>' +
        '<button class="btn btn-primary" data-act="tailor-now" data-id="' + job.id + '">' + UI.icon('spark') + '生成岗位定制简历</button></div>' +
      '</div>' +

      '<div class="grid" style="grid-template-columns:minmax(0,340px) minmax(0,1fr);align-items:start">' +
        '<div>' +
          '<section class="card card-pad mb-16">' +
            '<h3 class="card-title">' + UI.icon('briefcase') + '① 选择目标岗位</h3>' +
            '<div class="field"><select class="select" id="jobPicker">' +
              jobs.map(function (j) {
                var mm = E.matchJob(j, S.state.profile, S.state.resume);
                return '<option value="' + j.id + '"' + (j.id === job.id ? ' selected' : '') + '>' +
                  esc(j.company + ' · ' + j.title) + '（匹配 ' + mm.score + '%）</option>';
              }).join('') +
            '</select></div>' +
            '<div class="tiny muted">每份定制简历独立保存，修改通用简历不会影响已投递岗位的历史版本。</div>' +
          '</section>' +

          '<section class="card card-pad mb-16">' +
            '<h3 class="card-title">' + UI.icon('layers') + '② 岗位 JD 解析 <span class="sub">AI 自动结构化</span></h3>' +
            '<dl class="kv">' +
              '<dt>岗位</dt><dd>' + esc(job.title) + '</dd>' +
              '<dt>公司</dt><dd>' + esc(job.company) + '</dd>' +
              '<dt>城市</dt><dd>' + esc((job.cities || [job.city]).join(' / ')) + '</dd>' +
              '<dt>学历</dt><dd>' + esc(job.degree) + '</dd>' +
              '<dt>截止</dt><dd>' + esc(H.deadlineText(job)) + '</dd>' +
            '</dl>' +
            '<div class="mt-12"><div class="tiny muted mb-8">提取到的核心能力关键词</div>' +
              '<div class="chips">' + m.jdSkills.map(function (k) {
                var hitFlag = m.matchedSkills.indexOf(k) !== -1;
                return '<span class="chip ' + (hitFlag ? 'on' : '') + '" style="cursor:default">' + esc(k) + (hitFlag ? ' ✓' : '') + '</span>';
              }).join('') + '</div></div>' +
            '<div class="tiny muted mt-12">岗位共 ' + (job.requirements || []).length + ' 条任职要求，其中 ' + m.matchedSkills.length +
              ' 项在你的简历中找到了对应经历。</div>' +
          '</section>' +

          '<section class="card card-pad mb-16">' +
            '<h3 class="card-title">' + UI.icon('doc') + '③ 原始简历</h3>' +
            '<div class="small">' + esc(S.state.resume.basics.name) + ' · ' + esc(S.state.resume.basics.headline) + '</div>' +
            '<div class="tiny muted">最近更新：' + esc(S.state.resume.updatedAt) + ' · ' +
              (S.state.resume.projects || []).length + ' 个项目 · ' + (S.state.resume.internships || []).length + ' 段实习</div>' +
            '<div class="row mt-12"><a class="btn btn-sm" href="#/profile">编辑简历</a>' +
            '<button class="btn btn-sm btn-ghost" data-act="upload-resume">上传 / 粘贴</button></div>' +
          '</section>' +

          '<section class="card card-pad">' +
            '<h3 class="card-title">' + UI.icon('layers') + '简历库 <span class="sub">' + S.state.resumeVersions.length + ' 个版本</span></h3>' +
            (S.state.resumeVersions.length ? S.state.resumeVersions.map(function (v) {
              var j = S.jobById(v.jobId);
              var done = (v.changes || []).filter(function (c) { return c.status === 'accepted' || c.status === 'edited'; }).length;
              return '<a class="q-item" href="#/resume/v/' + v.id + '" style="display:block;color:inherit">' +
                '<div class="row"><span class="badge badge-brand">' + esc(j ? j.company : '未知') + '</span>' +
                (v.applied ? '<span class="badge badge-success">已用于投递</span>' : '<span class="badge">草稿</span>') + '</div>' +
                '<div class="small strong mt-8">' + esc(v.title) + '</div>' +
                '<div class="tiny muted">创建于 ' + esc(v.createdAt) + ' · 已接受 ' + done + ' 条修改</div></a>';
            }).join('') : '<div class="small muted">还没有定制版本，选择岗位后点击「生成岗位定制简历」。</div>') +
          '</section>' +
        '</div>' +

        '<section class="card card-pad">' +
          '<h3 class="card-title">' + UI.icon('doc') + '原始简历预览 <span class="sub">生成定制版时的对照基线</span></h3>' +
          '<div style="background:#f2f4f9;border-radius:12px;padding:18px">' + renderSheet(S.state.resume, []) + '</div>' +
        '</section>' +
      '</div>';

    return {
      html: html,
      mount: function (root) {
        var picker = root.querySelector('#jobPicker');
        if (picker) picker.addEventListener('change', function () {
          resumeState.jobId = picker.value;
          window.App.rerender();
        });
      }
    };
  };

  /* ---------------------- 生成定制简历（带 AI 过程动效） ---------------------- */

  V.resumeNew = function (params) {
    var job = S.jobById(params.jobId);
    if (!job) { window.location.hash = '#/resume'; return { html: '', mount: function () {} }; }

    var steps = ['解析岗位 JD，提取核心能力与关键词…', '读取原始简历，识别教育 / 实习 / 项目 / 技能…',
      '建立岗位要求与个人经历的对应关系…', '生成定制表达，并标注每处修改的依据…', '检查是否有编造风险与数据缺口…'];

    var html = '<div class="card card-pad" style="max-width:640px;margin:60px auto;text-align:center">' +
      '<div class="empty-ico" style="margin:0 auto 16px">' + UI.icon('spark', 24) + '</div>' +
      '<h1 style="font-size:19px;margin:0 0 6px">正在为「' + esc(job.company) + ' · ' + esc(job.title) + '」生成定制简历</h1>' +
      '<p class="muted small">本地 AI 引擎正在处理，请稍候…</p>' +
      '<div id="genSteps" style="text-align:left;max-width:440px;margin:22px auto 0"></div>' +
      '</div>';

    return {
      html: html,
      mount: function (root) {
        var box = root.querySelector('#genSteps');
        steps.forEach(function (t, i) {
          var row = document.createElement('div');
          row.className = 'row small mb-12';
          row.innerHTML = '<span class="typing" style="width:26px"><i></i><i></i><i></i></span><span class="muted">' + esc(t) + '</span>';
          box.appendChild(row);
          setTimeout(function () {
            row.innerHTML = '<span style="color:var(--success);width:26px;display:inline-flex">' + UI.icon('check') + '</span><span>' + esc(t) + '</span>';
          }, 420 * (i + 1));
        });

        setTimeout(function () {
          var match = E.matchJob(job, S.state.profile, S.state.resume);
          var changes = E.tailorResume(S.state.resume, job, match);
          var ver = S.createResumeVersion(job.id, changes);
          window.location.hash = '#/resume/v/' + ver.id;
          UI.toast('已生成 ' + changes.length + ' 条修改建议，请逐条确认', 'ok');
        }, 420 * steps.length + 500);
      }
    };
  };

  /* ---------------------- 定制版本详情 ---------------------- */

  V.resumeVersion = function (params) {
    var ver = S.versionById(params.versionId);
    if (!ver) return { html: '<div class="card empty"><b>该简历版本不存在</b><div class="small mt-12"><a href="#/resume">返回简历工坊</a></div></div>', mount: function () {} };
    var job = S.jobById(ver.jobId);
    var match = job ? E.matchJob(job, S.state.profile, S.state.resume) : null;

    if (!ver.changes || !ver.changes.length) {
      /* 老版本或示例数据没有建议，重新生成一次 */
      ver.changes = E.tailorResume(S.state.resume, job, match);
      S.save();
    }

    var counts = { pending: 0, accepted: 0, edited: 0, rejected: 0 };
    ver.changes.forEach(function (c) { counts[c.status || 'pending'] = (counts[c.status || 'pending'] || 0) + 1; });
    var applied = appliedVersion(ver);
    var sheet = renderSheet(applied.resume, applied.marks);

    var html = '' +
      '<div class="row mb-16 no-print">' +
        '<a class="btn btn-sm btn-ghost" href="#/resume">← 返回简历工坊</a>' +
        '<span class="spacer"></span>' +
        '<span class="badge">' + (ver.applied ? '已用于投递' : '草稿 · 未投递') + '</span>' +
      '</div>' +

      '<div class="page-head-row mb-16 no-print">' +
        '<div class="page-head"><h1>' + esc(ver.title) + '</h1>' +
          '<p>共 ' + ver.changes.length + ' 条建议 · 已接受 ' + (counts.accepted + counts.edited) + ' 条 · 待处理 ' + counts.pending + ' 条 · 已撤销 ' + counts.rejected + ' 条</p></div>' +
        '<div class="row">' +
          '<button class="btn" data-act="export-md" data-id="' + ver.id + '">' + UI.icon('download') + '导出 Markdown</button>' +
          '<button class="btn" data-act="print">' + UI.icon('download') + '导出 PDF</button>' +
          '<button class="btn btn-primary" data-act="bind-apply" data-id="' + ver.id + '">' + UI.icon('check') + '用于该岗位投递</button>' +
        '</div>' +
      '</div>' +

      '<div class="notice mb-16 no-print">' + UI.icon('shield') +
        '<div><b>内容可核验原则：</b>AI 只重组你已有的真实经历，不虚构数据、成果或职责。带 ⚠️ 的条目需要你补充事实后再使用。</div>' +
      '</div>' +

      '<div class="grid no-print" style="grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);align-items:start">' +
        '<div>' +
          '<section class="card card-pad">' +
            '<h3 class="card-title">' + UI.icon('spark') + '逐条修改建议 <span class="sub">接受 / 修改 / 撤销，你拥有最终决定权</span></h3>' +
            '<div class="row row-wrap mb-12">' +
              '<button class="btn btn-sm btn-primary" data-batch="accept">' + UI.icon('check') + '全部接受</button>' +
              '<button class="btn btn-sm" data-batch="reset">' + UI.icon('refresh') + '全部重置</button>' +
              '<span class="tiny muted">「能力缺口提示」不会被自动接受，需要你确认真实性。</span>' +
            '</div>' +
            ver.changes.map(function (c, idx) { return diffItem(c, ver, idx); }).join('') +
          '</section>' +
        '</div>' +

        '<div>' +
          '<section class="card card-pad mb-16" style="position:sticky;top:76px">' +
            '<h3 class="card-title">' + UI.icon('doc') + '定制简历预览 <span class="sub">高亮处为本次修改</span></h3>' +
            '<div style="background:#f2f4f9;border-radius:12px;padding:16px;max-height:640px;overflow:auto">' + sheet + '</div>' +
            '<div class="tiny muted mt-12">导出前请再次确认：数据、成果和职责是否与真实经历一致。</div>' +
          '</section>' +
        '</div>' +
      '</div>' +

      /* 打印时只显示这一段 */
      '<div class="print-only">' + sheet + '</div>';

    return {
      html: html,
      mount: function (root) {
        /* 逐条接受 / 撤销 */
        root.querySelectorAll('[data-chg-action]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var changeId = btn.getAttribute('data-chg');
            var action = btn.getAttribute('data-chg-action');
            if (action === 'edit') {
              var item = root.querySelector('[data-chg-item="' + changeId + '"]');
              var textarea = item.querySelector('textarea');
              S.updateChange(ver.id, changeId, 'edited', textarea.value);
              UI.toast('已保存你的修改', 'ok');
            } else if (action === 'accept') {
              S.updateChange(ver.id, changeId, 'accepted');
              UI.toast('已接受该条修改', 'ok');
            } else if (action === 'reject') {
              S.updateChange(ver.id, changeId, 'rejected');
              UI.toast('已撤销，将保留原始表达', 'warn');
            } else if (action === 'toggle-edit') {
              resumeState.editingChange = resumeState.editingChange === changeId ? null : changeId;
            }
            window.App.rerender();
          });
        });

        root.querySelectorAll('[data-batch]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var mode = btn.getAttribute('data-batch');
            ver.changes.forEach(function (c) {
              if (c.noApply) return;
              if (mode === 'accept') S.updateChange(ver.id, c.id, 'accepted');
              else S.updateChange(ver.id, c.id, 'pending');
            });
            UI.toast(mode === 'accept' ? '已接受全部建议（不含能力缺口提示）' : '已重置为未处理', 'ok');
            window.App.rerender();
          });
        });
      }
    };
  };

  function diffItem(c, ver, idx) {
    var statusLabel = { pending: '待处理', accepted: '已接受', edited: '已修改', rejected: '已撤销' };
    var statusCls = { pending: 'status-pending', accepted: 'status-accepted', edited: 'status-edited', rejected: 'status-rejected' };
    var st = c.status || 'pending';
    var editing = resumeState.editingChange === c.id;

    return '<div class="diff-item" data-chg-item="' + c.id + '">' +
      '<div class="diff-head">' +
        '<span class="badge badge-brand">' + esc(c.section) + '</span>' +
        (c.itemName ? '<span class="small strong">' + esc(c.itemName) + '</span>' : '') +
        (c.keywords && c.keywords.length ? c.keywords.map(function (k) { return '<span class="badge badge-success">' + esc(k) + '</span>'; }).join('') : '') +
        '<span class="spacer" style="flex:1"></span>' +
        (c.needsFact ? '<span class="badge badge-warn">⚠️ 需补充事实</span>' : '') +
        '<span class="status-pill ' + statusCls[st] + '">' + statusLabel[st] + '</span>' +
      '</div>' +
      '<div class="diff-body">' +
        '<div class="diff-pair">' +
          '<div class="diff-cell before"><span class="cell-label">修改前（你的原始表达）</span>' + esc(c.before) + '</div>' +
          (editing
            ? '<div class="diff-cell after"><span class="cell-label">修改后（可编辑）</span>' +
              '<textarea class="textarea" style="min-height:96px;background:#fff">' + esc(c.after) + '</textarea>' +
              '<div class="row mt-8"><button class="btn btn-sm btn-primary" data-chg-action="edit" data-chg="' + c.id + '">保存修改</button>' +
              '<button class="btn btn-sm btn-ghost" data-chg-action="toggle-edit" data-chg="' + c.id + '">取消</button></div></div>'
            : '<div class="diff-cell after"><span class="cell-label">修改后（AI 建议）</span>' + esc(c.after) + '</div>') +
        '</div>' +
        '<div class="diff-reason"><b>修改依据：</b>' + esc(c.reason) + '</div>' +
        (c.noApply ? '' :
          '<div class="row mt-12">' +
            '<button class="btn btn-sm ' + (st === 'accepted' || st === 'edited' ? 'btn-ghost' : 'btn-primary') + '" data-chg-action="accept" data-chg="' + c.id + '">接受</button>' +
            '<button class="btn btn-sm" data-chg-action="toggle-edit" data-chg="' + c.id + '">修改</button>' +
            '<button class="btn btn-sm btn-ghost" data-chg-action="reject" data-chg="' + c.id + '">撤销</button>' +
          '</div>') +
      '</div>' +
    '</div>';
  }

  /* ==================================================================
   * 二、AI 面试教练
   * ================================================================== */

  var interviewState = { jobId: null, questionId: null, answer: null, feedback: null };

  V.interview = function () {
    var candidates = S.state.jobs.filter(function (j) {
      return S.stageOf(j.id) === 'interview' || S.stageOf(j.id) === 'applied' || S.stageOf(j.id) === 'written';
    });
    if (!candidates.length) candidates = S.state.jobs.slice(0, 4);
    if (!interviewState.jobId) interviewState.jobId = (candidates[0] || {}).id;
    var job = S.jobById(interviewState.jobId) || candidates[0];

    var plan = S.state.interviewPlans[job.id];
    var reports = D.INTERVIEW_REPORTS.filter(function (r) { return r.jobId === job.id; });

    var html = '' +
      '<div class="page-head-row mb-16">' +
        '<div class="page-head"><h1>AI 面试教练</h1>' +
          '<p>汇总可获取的公开面经，结合岗位 JD 与个人经历，生成分类问题、个性化参考回答与模拟面试反馈</p></div>' +
        '<div class="row"><button class="btn ' + (plan ? '' : 'btn-primary') + '" data-act="gen-questions" data-id="' + job.id + '">' +
          UI.icon('spark') + (plan ? '重新生成问题清单' : '生成面试训练题') + '</button></div>' +
      '</div>' +

      '<div class="grid" style="grid-template-columns:minmax(0,320px) minmax(0,1fr);align-items:start">' +
        '<div>' +
          '<section class="card card-pad mb-16">' +
            '<h3 class="card-title">' + UI.icon('briefcase') + '选择岗位</h3>' +
            '<select class="select" id="ivJobPicker">' +
              candidates.map(function (j) {
                return '<option value="' + j.id + '"' + (j.id === job.id ? ' selected' : '') + '>' +
                  esc(j.company + ' · ' + j.title) + '（' + esc(S.stageMeta(S.stageOf(j.id) || 'saved').label) + '）</option>';
              }).join('') +
            '</select>' +
            '<div class="tiny muted mt-8">进入「面试中」的岗位会自动进入面试准备模式。</div>' +
          '</section>' +

          '<section class="card card-pad mb-16">' +
            '<h3 class="card-title">' + UI.icon('link') + '公开面经 <span class="sub">' + reports.length + ' 条</span></h3>' +
            (reports.length ? reports.map(function (r) {
              return '<div class="mb-12"><div class="row" style="gap:6px"><span class="badge badge-purple">' + esc(r.stage) + '</span>' +
                '<span class="tiny muted">' + esc(r.publishedAt) + '</span></div>' +
                '<div class="small mt-8">' + esc(r.source) + '</div>' +
                '<div class="tiny muted">' + esc(r.reliability) + '</div></div>';
            }).join('') : '<div class="small muted">该岗位暂无公开面经，将基于 JD 生成预测问题。</div>') +
            '<div class="notice mt-12">' + UI.icon('alert') + '<div>来自社区的面经只能作为参考，不是企业官方题库。</div></div>' +
          '</section>' +

          '<section class="card card-pad">' +
            '<h3 class="card-title">' + UI.icon('clock') + '练习记录 <span class="sub">' + S.state.interviewSessions.length + ' 次</span></h3>' +
            (S.state.interviewSessions.length ? S.state.interviewSessions.slice(0, 6).map(function (s) {
              var j = S.jobById(s.jobId);
              return '<div class="mb-12"><div class="row"><span class="badge badge-' + (s.feedback.score >= 75 ? 'success' : s.feedback.score >= 60 ? 'warn' : 'danger') + '">' + s.feedback.score + ' 分</span>' +
                '<span class="tiny muted">' + esc(j ? j.company : '') + '</span></div>' +
                '<div class="tiny mt-8" style="color:var(--text-2)">' + esc(s.question.text.slice(0, 46)) + '…</div></div>';
            }).join('') : '<div class="small muted">还没有模拟面试记录。</div>') +
          '</section>' +
        '</div>' +

        '<div>' +
          (plan ? questionPlanHtml(job, plan) : emptyPlanHtml(job)) +
        '</div>' +
      '</div>';

    return {
      html: html,
      mount: function (root) {
        var picker = root.querySelector('#ivJobPicker');
        if (picker) picker.addEventListener('change', function () {
          interviewState.jobId = picker.value;
          interviewState.questionId = null;
          interviewState.feedback = null;
          window.App.rerender();
        });
        bindQuestionInteractions(root, job, plan);
      }
    };
  };

  function emptyPlanHtml(job) {
    return '<section class="card card-pad"><div class="empty">' +
      '<div class="empty-ico">' + UI.icon('chat', 24) + '</div>' +
      '<b>还没有该岗位的面试题清单</b>' +
      '<div class="small">点击「生成面试训练题」，AI 会整合公开面经、岗位 JD 与你的项目经历，<br>产出分环节的问题清单、个性化回答结构与模拟面试反馈。</div>' +
      '<div class="mt-16"><button class="btn btn-primary" data-act="gen-questions" data-id="' + job.id + '">' + UI.icon('spark') + '生成面试训练题</button></div>' +
      '</div></section>';
  }

  function questionPlanHtml(job, plan) {
    var all = [];
    plan.groups.forEach(function (g) { all = all.concat(g.questions); });
    var selected = all.filter(function (q) { return q.id === interviewState.questionId; })[0];
    if (!selected && all.length) { selected = all[0]; interviewState.questionId = selected.id; }

    var typeBadge = function (q) {
      if (q.type === 'real') return '<span class="badge badge-success">真实面经题</span>';
      if (q.type === 'personal') return '<span class="badge badge-purple">简历追问</span>';
      return '<span class="badge badge-warn">AI 预测题</span>';
    };

    return '' +
      '<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);align-items:start">' +
        '<section class="card card-pad">' +
          '<h3 class="card-title">' + UI.icon('chat') + '问题清单 <span class="sub">共 ' + plan.total + ' 题 · 生成于 ' + esc(plan.generatedAt) + '</span></h3>' +
          plan.groups.map(function (g) {
            return '<div class="mb-16"><div class="row mb-8"><b class="small">' + esc(g.category) + '</b>' +
              '<span class="tiny muted">' + g.questions.length + ' 题</span></div>' +
              g.questions.map(function (q) {
                return '<div class="q-item' + (q.id === interviewState.questionId ? ' on' : '') + '" data-q="' + q.id + '">' +
                  '<div class="q-text">' + esc(q.text) + '</div>' +
                  '<div class="row row-wrap" style="gap:6px">' + typeBadge(q) +
                    (q.source ? '<span class="tiny muted">' + esc(q.source.name) + '</span>' : '') + '</div>' +
                '</div>';
              }).join('') + '</div>';
          }).join('') +
        '</section>' +
        '<section class="card card-pad">' + questionDetailHtml(job, selected) + '</section>' +
      '</div>';
  }

  function questionDetailHtml(job, q) {
    if (!q) return '<div class="empty small">选择左侧任意问题开始准备</div>';
    var ans = E.buildAnswer(q, job, S.state.resume);
    var fb = interviewState.feedback && interviewState.feedback.questionId === q.id ? interviewState.feedback : null;

    return '' +
      '<div class="row row-wrap mb-12" style="gap:6px">' +
        (q.type === 'real' ? '<span class="badge badge-success">真实面经题</span>' : q.type === 'personal' ? '<span class="badge badge-purple">简历追问</span>' : '<span class="badge badge-warn">AI 预测题</span>') +
        '<span class="badge">' + esc(q.category) + '</span>' +
        (q.source ? '<span class="tiny muted">来源：' + esc(q.source.name) + ' · ' + esc(q.source.publishedAt) + '</span>' : '<span class="tiny muted">由 AI 基于岗位要求推测，非企业真实题库</span>') +
      '</div>' +
      '<h3 style="font-size:16px;margin:0 0 16px;line-height:1.6">' + esc(q.text) + '</h3>' +

      '<div class="card-title">' + UI.icon('layers') + '回答组织建议</div>' +
      ans.skeleton.split('\n').map(function (line) {
        var i = line.indexOf('：');
        var k = i > 0 ? line.slice(0, i) : '要点';
        var v = i > 0 ? line.slice(i + 1) : line;
        return '<div class="star-step"><div class="k">' + esc(k) + '</div><div>' + esc(v) + '</div></div>';
      }).join('') +

      '<div class="card-title mt-24">' + UI.icon('spark') + 'AI 参考回答 <span class="sub">结构示意</span></div>' +
      '<div class="evidence" style="border-left-color:var(--brand)">' + esc(ans.reference).replace(/\n/g, '<br>') + '</div>' +

      '<div class="card-title mt-24">' + UI.icon('doc') + '可用的个人素材</div>' +
      (ans.materials.length ? '<ul class="list-check ok">' + ans.materials.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>'
        : '<div class="small muted">你的简历中缺少与该问题直接相关的经历，建议先补充项目素材。</div>') +

      '<div class="notice mt-16">' + UI.icon('alert') + '<div><b>需要你补充的事实：</b>' +
        ans.factsToFill.map(function (f) { return esc(f); }).join('、') + '。AI 不会替你编造这些信息。</div></div>' +

      '<div class="card-title mt-24">' + UI.icon('chat') + '模拟面试</div>' +
      (fb ? feedbackHtml(q, fb) :
        '<div class="field"><textarea class="textarea" id="answerInput" placeholder="输入或口述你的回答（可以先写下要点），提交后 AI 会从逻辑结构、岗位相关性、证据充分性、表达清晰度四个维度给反馈。">' +
        esc(interviewState.answer || '') + '</textarea></div>' +
        '<div class="row"><button class="btn btn-primary" data-act="submit-answer" data-q="' + q.id + '">' + UI.icon('send') + '提交回答并获取反馈</button>' +
        '<span class="tiny muted">提示：填入「调研了 30 位用户」这类具体数字，评分会显著提高。</span></div>');
  }

  function feedbackHtml(q, fb) {
    var f = fb.feedback;
    function cell(k, v) {
      return '<div class="score-cell"><div class="v" style="color:' + H.matchColor(v) + '">' + Math.round(v) + '</div>' +
        '<div class="k">' + esc(k) + '</div><div class="bar"><i style="width:' + Math.round(v) + '%;background:' + H.matchColor(v) + '"></i></div></div>';
    }
    return '' +
      '<div class="row mb-16"><div style="font-size:34px;font-weight:650;color:' + H.matchColor(f.score) + ';letter-spacing:-1px">' + f.score + '</div>' +
        '<div><div class="strong">综合得分</div><div class="tiny muted">基于四个维度加权计算，用于发现改进方向而非评价你个人</div></div></div>' +
      '<div class="score-grid mb-16">' +
        cell('逻辑结构', f.dimensions.structure) + cell('岗位相关性', f.dimensions.relevance) +
        cell('证据充分性', f.dimensions.evidence) + cell('表达清晰度', f.dimensions.clarity) +
      '</div>' +
      '<div class="card-title">' + UI.icon('check') + '反馈与改进建议</div>' +
      '<ul class="list-check">' + f.feedback.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<div class="card-title mt-24">' + UI.icon('chat') + '面试官可能继续追问</div>' +
      '<ul class="list-check gap">' + f.followUps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<div class="row mt-16"><button class="btn" data-act="retry-answer" data-q="' + q.id + '">' + UI.icon('refresh') + '再练一次</button>' +
      '<span class="tiny muted">你的回答原文：' + esc((fb.answer || '').slice(0, 40)) + '…</span></div>';
  }

  function bindQuestionInteractions(root, job, plan) {
    root.querySelectorAll('[data-q]').forEach(function (el) {
      if (el.tagName === 'DIV' && el.classList.contains('q-item')) {
        el.addEventListener('click', function () {
          interviewState.questionId = el.getAttribute('data-q');
          interviewState.feedback = null;
          interviewState.answer = '';
          window.App.rerender();
        });
      }
    });
  }

  /* ==================================================================
   * 三、求职进度中心
   * ================================================================== */

  var progressState = { showAddTask: false };

  V.progress = function () {
    var st = S.stats();
    var openTasks = S.state.tasks.filter(function (t) { return !t.done; });
    var doneTasks = S.state.tasks.filter(function (t) { return t.done; });

    var html = '' +
      '<div class="page-head-row mb-16">' +
        '<div class="page-head"><h1>求职进度中心</h1>' +
          '<p>把每个岗位当成一个独立的求职项目：收藏、投递、笔试、面试、结果都记录在同一个档案里</p></div>' +
        '<div class="row"><button class="btn" data-act="export-state">' + UI.icon('download') + '导出数据</button>' +
        '<button class="btn btn-primary" data-act="toggle-add-task">' + UI.icon('plus') + '新建待办</button></div>' +
      '</div>' +

      '<div class="grid grid-4 mb-16">' +
        H.statCard('已收藏岗位', st.favorites, '含已投递岗位', 'star', '') +
        H.statCard('已投递', st.applied, '投递后自动记录时间', 'send', 'accent') +
        H.statCard('面试中', st.interviewing, '进入面试准备模式', 'chat', 'warn') +
        H.statCard('待办任务', st.tasks, '按截止时间排序', 'check', 'good') +
      '</div>' +

      (progressState.showAddTask ? addTaskForm() : '') +

      '<section class="card card-pad mb-16">' +
        '<h3 class="card-title">' + UI.icon('layers') + '投递看板 <span class="sub">拖动卡片即可更新状态</span></h3>' +
        '<div class="kanban">' + S.STAGES.map(function (stage) { return kanbanColumn(stage); }).join('') + '</div>' +
        '<div class="notice mt-16">' + UI.icon('alert') +
          '<div>如果企业没有提供可用的招聘状态接口，产品不会仅凭「投递后没有消息」就推断你已被拒绝，也不会把社区传言当作企业正式通知。</div>' +
        '</div>' +
      '</section>' +

      '<div class="grid grid-2" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">' +
        '<section class="card card-pad">' +
          '<h3 class="card-title">' + UI.icon('check') + '待办任务 <span class="sub">' + openTasks.length + ' 项未完成</span></h3>' +
          (S.state.tasks.length ? S.state.tasks.map(function (t) {
            var j = t.jobId ? S.jobById(t.jobId) : null;
            return '<div class="row mb-12" style="align-items:flex-start;gap:10px">' +
              '<input type="checkbox" data-task="' + t.id + '"' + (t.done ? ' checked' : '') + ' style="margin-top:4px">' +
              '<div style="flex:1 1 auto">' +
                '<div class="small ' + (t.done ? 'muted' : 'strong') + '" style="' + (t.done ? 'text-decoration:line-through' : '') + '">' + esc(t.title) + '</div>' +
                '<div class="tiny muted">' + (j ? esc(j.company + ' · ' + j.title) + ' · ' : '') + esc(t.due || '无截止时间') +
                  ' · <span class="badge badge-' + (t.priority === 'high' ? 'danger' : t.priority === 'low' ? 'muted' : 'warn') + '">' +
                  (t.priority === 'high' ? '高优先级' : t.priority === 'low' ? '低优先级' : '中优先级') + '</span></div>' +
              '</div>' +
              '<button class="btn btn-sm btn-ghost" data-act="del-task" data-id="' + t.id + '">' + UI.icon('trash') + '</button>' +
            '</div>';
          }).join('') : '<div class="small muted">暂无待办</div>') +
          (doneTasks.length ? '<div class="tiny muted mt-12">已完成 ' + doneTasks.length + ' 项</div>' : '') +
        '</section>' +

        '<section class="card card-pad">' +
          '<h3 class="card-title">' + UI.icon('chart') + '投递结构分析 <span class="sub">帮助你调整求职策略</span></h3>' +
          '<div class="funnel mb-16">' + S.STAGES.filter(function (s) { return s.id !== 'rejected'; }).map(function (s) {
            var n = st.byStage[s.id] || 0;
            var max = Math.max(1, st.favorites);
            var w = Math.max(14, Math.round(n / max * 100));
            return '<div class="funnel-row"><div class="tiny muted" style="width:52px">' + esc(s.label) + '</div>' +
              '<div class="funnel-bar" style="width:' + w + '%;background:' + s.color + '1f;color:' + s.color + '">' + n + '</div></div>';
          }).join('') + '</div>' +
          '<div class="card-title">按岗位方向</div>' +
          '<div class="bar-chart">' + (Object.keys(st.byDirection).length ? Object.keys(st.byDirection).map(function (k) {
            var n = st.byDirection[k];
            var max = Math.max.apply(null, Object.keys(st.byDirection).map(function (x) { return st.byDirection[x]; }));
            return '<div class="bar-row"><span class="muted">' + esc(k) + '</span>' +
              '<div class="track"><i style="width:' + Math.round(n / max * 100) + '%"></i></div>' +
              '<b>' + n + '</b></div>';
          }).join('') : '<div class="small muted">还没有投递记录</div>') + '</div>' +
          '<div class="notice info mt-16">' + UI.icon('info') +
            '<div>指标设计：信息效率（有效新增岗位数 / 过期信息率）、求职效率（简历生成完成率 / 单份简历耗时）、面试效果（准备完成率 / 自评提升）。</div>' +
          '</div>' +
        '</section>' +
      '</div>';

    return {
      html: html,
      mount: function (root) {
        /* 拖拽更新状态 */
        var dragging = null;
        root.querySelectorAll('.kcard').forEach(function (card) {
          card.addEventListener('dragstart', function () {
            dragging = card.getAttribute('data-job');
            card.classList.add('dragging');
          });
          card.addEventListener('dragend', function () { card.classList.remove('dragging'); });
        });
        root.querySelectorAll('.kcol').forEach(function (col) {
          col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('drop'); });
          col.addEventListener('dragleave', function () { col.classList.remove('drop'); });
          col.addEventListener('drop', function (e) {
            e.preventDefault();
            col.classList.remove('drop');
            var stage = col.getAttribute('data-stage');
            if (dragging && stage) {
              S.setStage(dragging, stage);
              UI.toast('已移动到「' + S.stageMeta(stage).label + '」', 'ok');
              window.App.rerender();
            }
          });
        });

        root.querySelectorAll('[data-task]').forEach(function (cb) {
          cb.addEventListener('change', function () {
            S.toggleTask(cb.getAttribute('data-task'));
            window.App.rerender();
          });
        });

        /* 无拖拽环境（如移动端 / 键盘操作）下的状态变更方式 */
        root.querySelectorAll('[data-move]').forEach(function (sel) {
          sel.addEventListener('change', function () {
            S.setStage(sel.getAttribute('data-move'), sel.value);
            UI.toast('已移动到「' + S.stageMeta(sel.value).label + '」', 'ok');
            window.App.rerender();
          });
        });

        var addForm = root.querySelector('#addTaskForm');
        if (addForm) {
          addForm.querySelector('[data-act="save-task"]').addEventListener('click', function () {
            var title = addForm.querySelector('#taskTitle').value.trim();
            if (!title) { UI.toast('请填写待办内容', 'warn'); return; }
            S.addTask({
              title: title,
              jobId: addForm.querySelector('#taskJob').value || null,
              due: addForm.querySelector('#taskDue').value || '',
              priority: addForm.querySelector('#taskPriority').value
            });
            progressState.showAddTask = false;
            UI.toast('已添加待办', 'ok');
            window.App.rerender();
          });
        }
      }
    };
  };

  function addTaskForm() {
    return '<section class="card card-pad mb-16" id="addTaskForm"><h3 class="card-title">' + UI.icon('plus') + '新建待办</h3>' +
      '<div class="grid grid-3">' +
        '<div class="field"><label>待办内容</label><input class="input" id="taskTitle" placeholder="例如：准备产品经理一面"></div>' +
        '<div class="field"><label>关联岗位</label><select class="select" id="taskJob"><option value="">不关联</option>' +
          S.state.jobs.filter(function (j) { return S.stageOf(j.id); }).map(function (j) {
            return '<option value="' + j.id + '">' + esc(j.company + ' · ' + j.title) + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field"><label>截止时间</label><input class="input" id="taskDue" type="date" value="' + D.META.today + '"></div>' +
      '</div>' +
      '<div class="row"><div class="field" style="margin:0;width:180px"><label>优先级</label>' +
        '<select class="select" id="taskPriority"><option value="high">高</option><option value="medium" selected>中</option><option value="low">低</option></select></div>' +
        '<span class="spacer" style="flex:1"></span>' +
        '<button class="btn" data-act="toggle-add-task">取消</button>' +
        '<button class="btn btn-primary" data-act="save-task">保存</button></div>' +
      '</section>';
  }

  function kanbanColumn(stage) {
    var items = S.state.jobs.filter(function (j) { return S.stageOf(j.id) === stage.id; });
    return '<div class="kcol" data-stage="' + stage.id + '">' +
      '<div class="kcol-head"><span class="kdot" style="background:' + stage.color + '"></span>' + esc(stage.label) +
        '<span class="spacer" style="flex:1"></span><span class="n">' + items.length + '</span></div>' +
      (items.length ? items.map(function (j) {
        var app = S.applicationOf(j.id);
        return '<div class="kcard" draggable="true" data-job="' + j.id + '">' +
          '<div class="row" style="gap:8px;align-items:flex-start">' + H.logoBox(j, 28) +
            '<div style="flex:1 1 auto;min-width:0"><div class="kt">' + esc(j.title) + '</div>' +
            '<div class="kc">' + esc(j.company) + ' · ' + esc(j.city) + '</div></div></div>' +
          '<div class="krow">' +
            (app && app.appliedAt ? '<span class="badge badge-muted">投递 ' + esc(app.appliedAt.slice(5)) + '</span>' : '') +
            (j.deadline && j.deadline !== '待官方确认' ? '<span class="badge badge-warn">' + esc(H.deadlineText(j)) + '</span>' : '') +
            (app && app.resumeVersionId ? '<span class="badge badge-brand">已定制简历</span>' : '') +
          '</div>' +
          '<div class="krow"><a class="tiny" href="#/job/' + j.id + '">查看岗位</a>' +
            '<span class="tiny muted">·</span><a class="tiny" href="#/interview/' + j.id + '">准备面试</a></div>' +
          '<div class="krow"><select class="select" data-move="' + j.id + '" style="font-size:12px;padding:4px 8px" title="不使用拖拽时可直接选择目标状态">' +
            S.STAGES.map(function (s) {
              return '<option value="' + s.id + '"' + (s.id === stage.id ? ' selected' : '') + '>移动到：' + esc(s.label) + '</option>';
            }).join('') +
          '</select></div>' +
        '</div>';
      }).join('') : '<div class="tiny muted" style="padding:6px 2px">暂无岗位</div>') +
    '</div>';
  }

  /* ==================================================================
   * 四、个人画像
   * ================================================================== */

  V.profile = function () {
    var p = S.state.profile;
    var r = S.state.resume;
    var citiesAll = ['北京', '上海', '深圳', '广州', '杭州', '成都', '武汉', '南京', '西安', '苏州'];
    var dirsAll = ['产品', '数据', '运营', '设计', '技术'];

    function chipRow(name, all, current) {
      return '<div class="chips" data-profile-chips="' + name + '">' + all.map(function (v) {
        var on = (current || []).indexOf(v) !== -1;
        return '<button class="chip' + (on ? ' on' : '') + '" data-val="' + esc(v) + '">' + esc(v) + '</button>';
      }).join('') + '</div>';
    }

    var html = '' +
      '<div class="page-head-row mb-16">' +
        '<div class="page-head"><h1>个人画像与简历库</h1>' +
          '<p>画像决定「岗位匹配」的判断依据，简历决定「定制简历」与「面试回答」的素材来源</p></div>' +
        '<div class="row"><button class="btn" data-act="upload-resume">' + UI.icon('upload') + '上传 / 粘贴简历</button>' +
        '<button class="btn btn-primary" data-act="save-profile">保存画像</button></div>' +
      '</div>' +

      '<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start">' +
        '<section class="card card-pad">' +
          '<h3 class="card-title">' + UI.icon('user') + '基本信息</h3>' +
          '<div class="grid grid-2">' +
            '<div class="field"><label>姓名</label><input class="input" id="pName" value="' + esc(p.name) + '"></div>' +
            '<div class="field"><label>学校</label><input class="input" id="pSchool" value="' + esc(p.school) + '"></div>' +
            '<div class="field"><label>学历</label><select class="select" id="pDegree">' +
              ['大专', '本科', '硕士', '博士'].map(function (d) { return '<option' + (p.degree === d ? ' selected' : '') + '>' + d + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="field"><label>毕业时间</label><input class="input" id="pGrad" value="' + esc(p.gradYear) + '"></div>' +
          '</div>' +
          '<div class="field"><label>专业</label><input class="input" id="pMajor" value="' + esc(p.major) + '"></div>' +
          '<div class="field"><label>目标城市（可多选）</label>' + chipRow('cities', citiesAll, p.cities) + '</div>' +
          '<div class="field"><label>岗位方向（可多选）</label>' + chipRow('directions', dirsAll, p.directions) + '</div>' +
          '<div class="grid grid-2">' +
            '<div class="field"><label>薪资期望</label><input class="input" id="pSalary" value="' + esc(p.salaryExpect) + '"></div>' +
            '<div class="field"><label>优先投递方向</label><input class="input" id="pPriority" value="' + esc(p.priority) + '"></div>' +
          '</div>' +
          '<div class="field"><label>目标公司（逗号分隔）</label><input class="input" id="pCompanies" value="' + esc((p.targetCompanies || []).join('、')) + '"></div>' +
          '<div class="notice info">' + UI.icon('info') +
            '<div>画像只保存在你的浏览器本地（localStorage），不会上传到任何服务器。</div></div>' +
        '</section>' +

        '<section class="card card-pad">' +
          '<h3 class="card-title">' + UI.icon('doc') + '简历内容 <span class="sub">AI 只会基于这些真实内容改写</span></h3>' +
          '<div class="field"><label>个人定位 / headline</label>' +
            '<input class="input" id="rHeadline" value="' + esc(r.basics.headline) + '"></div>' +

          '<h4 class="small strong mb-8">项目经历</h4>' +
          (r.projects || []).map(function (proj, i) {
            return '<div class="card card-pad mb-12" style="box-shadow:none;background:var(--surface-2)">' +
              '<div class="row mb-8"><input class="input" data-proj="' + i + '-name" value="' + esc(proj.name) + '" style="flex:1 1 auto">' +
                '<button class="btn btn-sm btn-ghost" data-act="del-project" data-idx="' + i + '">' + UI.icon('trash') + '</button></div>' +
              '<input class="input mb-8" data-proj="' + i + '-role" value="' + esc(proj.role) + '">' +
              (proj.bullets || []).map(function (b, bi) {
                return '<textarea class="textarea mb-8" data-proj="' + i + '-b' + bi + '" style="min-height:60px">' + esc(b) + '</textarea>';
              }).join('') +
              '</div>';
          }).join('') +
          '<button class="btn btn-sm" data-act="add-project">' + UI.icon('plus') + '添加项目</button>' +

          '<h4 class="small strong mt-24 mb-8">实习经历</h4>' +
          (r.internships || []).map(function (it, i) {
            return '<div class="card card-pad mb-12" style="box-shadow:none;background:var(--surface-2)">' +
              '<input class="input mb-8" data-int="' + i + '-company" value="' + esc(it.company) + '">' +
              '<textarea class="textarea" data-int="' + i + '-b0" style="min-height:60px">' + esc((it.bullets || [])[0] || '') + '</textarea>' +
              '</div>';
          }).join('') +
          '<button class="btn btn-sm" data-act="add-internship">' + UI.icon('plus') + '添加实习</button>' +

          '<div class="field mt-24"><label>技能标签（逗号分隔）</label>' +
            '<input class="input" id="rSkills" value="' + esc((r.skills || []).join('，')) + '"></div>' +
          '<div class="field"><label>荣誉奖项（逗号分隔）</label>' +
            '<input class="input" id="rAwards" value="' + esc((r.awards || []).join('，')) + '"></div>' +

          '<button class="btn btn-primary btn-block" data-act="save-profile">' + UI.icon('check') + '保存全部修改</button>' +
        '</section>' +
      '</div>';

    return {
      html: html,
      mount: function (root) {
        root.querySelectorAll('[data-profile-chips]').forEach(function (box) {
          box.addEventListener('click', function (e) {
            var btn = e.target.closest('.chip');
            if (btn) btn.classList.toggle('on');
          });
        });
      }
    };
  };

  /* ==================================================================
   * 五、设置与数据
   * ================================================================== */

  V.settings = function () {
    var s = S.state.settings;
    var html = '' +
      '<div class="page-head mb-16"><h1>设置与数据</h1>' +
        '<p>AI 能力配置、数据导出与产品合规说明</p></div>' +

      '<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start">' +
        '<section class="card card-pad">' +
          '<h3 class="card-title">' + UI.icon('spark') + 'AI 能力配置</h3>' +
          '<div class="notice ok mb-16">' + UI.icon('check') +
            '<div><b>当前模式：本地规则引擎。</b>所有「AI 能力」（JD 解析、岗位匹配、简历定制、面试题生成、回答评估）都在浏览器本地运行，可离线演示，结果完全可解释、可复现。</div></div>' +
          '<label class="row small mb-12" style="cursor:pointer">' +
            '<input type="checkbox" id="useRemote"' + (s.useRemote ? ' checked' : '') + '> 使用远程大模型（OpenAI 兼容接口）替代本地引擎' +
          '</label>' +
          '<div class="field"><label>接口地址</label><input class="input" id="sEndpoint" placeholder="https://api.example.com/v1/chat/completions" value="' + esc(s.endpoint) + '"></div>' +
          '<div class="field"><label>API Key</label><input class="input" id="sKey" type="password" placeholder="sk-…" value="' + esc(s.apiKey) + '"></div>' +
          '<div class="field"><label>模型名称</label><input class="input" id="sModel" value="' + esc(s.model || 'gpt-4o-mini') + '"></div>' +
          '<div class="row"><button class="btn btn-primary" data-act="save-settings">保存配置</button>' +
            '<button class="btn" data-act="test-model">测试连接</button></div>' +
          '<div class="notice mt-16">' + UI.icon('lock') +
            '<div>API Key 仅保存在当前浏览器的 localStorage 中。浏览器直连第三方接口存在跨域与密钥暴露风险，正式部署建议通过你自己的后端代理转发。</div></div>' +
        '</section>' +

        '<div>' +
          '<section class="card card-pad mb-16">' +
            '<h3 class="card-title">' + UI.icon('layers') + '数据管理</h3>' +
            '<div class="row row-wrap">' +
              '<button class="btn" data-act="export-state">' + UI.icon('download') + '导出全部数据（JSON）</button>' +
              '<button class="btn" data-act="import-state">' + UI.icon('upload') + '导入数据</button>' +
              '<button class="btn btn-danger" data-act="reset-state">' + UI.icon('refresh') + '恢复示例数据</button>' +
            '</div>' +
            '<div class="tiny muted mt-12">导出内容包括：个人画像、简历、岗位库、投递记录、简历定制版本、面试练习记录与待办。</div>' +
          '</section>' +

          '<section class="card card-pad mb-16">' +
            '<h3 class="card-title">' + UI.icon('shield') + '三条产品原则</h3>' +
            D.PRINCIPLES.map(function (p) {
              return '<div class="analysis-block mb-12"><h4>' + esc(p.title) + '</h4>' +
                '<div class="small" style="color:var(--text-2)">' + esc(p.desc) + '</div></div>';
            }).join('') +
          '</section>' +

          '<section class="card card-pad">' +
            '<h3 class="card-title">' + UI.icon('info') + '关于演示数据</h3>' +
            '<div class="small" style="color:var(--text-2)">' +
              '本产品为求职季产品设计原型，当前内置的岗位、公司、面经均为<b>虚构示例数据</b>，用于演示「发现机会 → 判断匹配 → 定制简历 → 准备面试 → 跟踪结果」的完整链路。' +
              '<br><br>不用于真实投递决策。真实部署时应接入企业官方招聘页、官方接口或经授权的数据源。' +
            '</div>' +
          '</section>' +
        '</div>' +
      '</div>';

    return {
      html: html,
      mount: function (root) {
        var remote = root.querySelector('#useRemote');
        if (remote) remote.addEventListener('change', function () {
          S.updateSettings({ useRemote: remote.checked });
          UI.toast(remote.checked ? '已切换到远程模型模式（未配置时自动回退本地引擎）' : '已切换回本地规则引擎', 'ok');
        });
      }
    };
  };

  /* 导出工具供 app.js 使用 */
  V._export = { appliedVersion: appliedVersion, versionToMarkdown: versionToMarkdown, renderSheet: renderSheet };
  V._interviewState = interviewState;
  V._resumeState = resumeState;
  V._progressState = progressState;
  V._setInterviewJob = function (id) {
    interviewState.jobId = id;
    interviewState.questionId = null;
    interviewState.feedback = null;
    interviewState.answer = '';
  };

})(window);
