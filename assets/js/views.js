/* ------------------------------------------------------------------
 * views.js — 页面渲染层
 * 每个视图返回 { html, mount }，由 app.js 的极简路由挂载。
 * ---------------------------------------------------------------- */
(function (window) {
  'use strict';

  var D = window.AIData;
  var E = window.AIEngine;
  var S = window.Store;
  var UI = window.UI;

  /* ============================ 小工具 ============================ */

  var Views = {};

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function matchColor(score) {
    if (score >= 85) return '#1f9d67';
    if (score >= 72) return '#3b6ef6';
    if (score >= 60) return '#e08a1e';
    return '#8a93a6';
  }

  function ring(score, size) {
    var c = matchColor(score);
    return '<div class="match-ring" style="--p:' + score + ';--ring:' + c + ';' +
      (size ? 'width:' + size + 'px;height:' + size + 'px;flex-basis:' + size + 'px;' : '') + '">' +
      '<span style="color:' + c + '">' + score + '</span></div>';
  }

  function stageBadge(stageId) {
    if (!stageId) return '';
    var m = S.stageMeta(stageId);
    return '<span class="badge" style="background:' + m.color + '1a;border-color:' + m.color + '40;color:' + m.color + '">' + esc(m.label) + '</span>';
  }

  function sourceBadge(job) {
    var allCommunity = (job.sources || []).length && (job.sources || []).every(function (s) {
      return /公众号|小红书|论坛|分享|线索|用户/.test(s.channel);
    });
    if (allCommunity) return '<span class="badge badge-warn">社区线索 · 待核验</span>';
    var hasOfficial = (job.sources || []).some(function (s) { return /官网|官方|校园招聘平台|企业招聘/.test(s.channel); });
    if (hasOfficial) return '<span class="badge badge-success">官方来源</span>';
    return '<span class="badge badge-muted">来源待确认</span>';
  }

  function statusBadge(job) {
    if (job.status === 'closed') return '<span class="badge badge-muted">已截止</span>';
    if (job.status === 'open') return '<span class="badge badge-brand">招聘中</span>';
    return '<span class="badge badge-warn">状态待确认</span>';
  }

  function deadlineText(job) {
    if (!job.deadline || job.deadline === '待官方确认') return '截止时间待确认';
    var d = new Date(job.deadline.replace(/\./g, '-'));
    if (isNaN(d)) return '截止 ' + job.deadline;
    var diff = Math.round((d - new Date(D.META.today)) / 86400000);
    if (diff < 0) return '已截止';
    if (diff === 0) return '今天截止';
    if (diff <= 7) return diff + ' 天后截止';
    return '截止 ' + job.deadline;
  }

  function logoBox(job, size) {
    var px = size || 42;
    return '<div class="logo-box" style="background:' + (job.logoColor || '#6b7f9e') +
      ';width:' + px + 'px;height:' + px + 'px;flex-basis:' + px + 'px;font-size:' + Math.round(px / 2.6) + 'px">' +
      esc(job.logoText || job.company.slice(0, 1)) + '</div>';
  }

  function jobMetaLine(job) {
    return [
      esc(job.city),
      esc(job.degree),
      esc(job.batch),
      esc(job.salary)
    ].filter(Boolean).map(function (t) { return '<span>' + t + '</span>'; }).join('');
  }

  function statusText(job) {
    var myStage = S.stageOf(job.id);
    return myStage ? stageBadge(myStage) : '';
  }

  function starIco(n) {
    return '<svg viewBox="0 0 24 24" width="' + (n || 15) + '" height="' + (n || 15) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.6 6.4.8-4.6 4.4 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.4l6.4-.8z"/></svg>';
  }

  /* 岗位详情链接 */
  function jobLink(job, cls) {
    return '<a class="' + (cls || 'job-title') + '" href="#/job/' + job.id + '">' + esc(job.title) + '</a>';
  }

  function filteredJobs(opts) {
    var f = opts || {};
    var q = (f.q || '').trim().toLowerCase();
    return S.state.jobs.filter(function (j) {
      if (f.onlyFav && !S.isFavorite(j.id)) return false;
      if (f.city && f.city !== 'all' && (j.cities || [j.city]).indexOf(f.city) === -1) return false;
      if (f.direction && f.direction !== 'all' && j.direction !== f.direction) return false;
      if (f.degree && f.degree !== 'all' && j.degree !== f.degree) return false;
      if (f.source === 'official' && j.sourceType !== 'official') return false;
      if (f.source === 'community' && j.sourceType !== 'community') return false;
      if (f.status && f.status !== 'all' && j.status !== f.status) return false;
      if (q) {
        var blob = [j.company, j.title, j.city, j.direction, j.industry, (j.keywords || []).join(' ')].join(' ').toLowerCase();
        if (blob.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function filterChips(name, values, current, allLabel) {
    var html = '<div class="chips" data-chipgroup="' + name + '">';
    html += '<button class="chip' + (!current || current === 'all' ? ' on' : '') + '" data-chip="all">' + esc(allLabel || '全部') + '</button>';
    values.forEach(function (v) {
      html += '<button class="chip' + (current === v ? ' on' : '') + '" data-chip="' + esc(v) + '">' + esc(v) + '</button>';
    });
    return html + '</div>';
  }

  /* ============================ 工作台 ============================ */

  Views.dashboard = function () {
    var st = S.stats();
    var report = E.dailyReport(S.state.jobs, S.state.profile, S.state.resume);
    var top = report.recommended;
    var topMatch = top ? E.matchJob(top.job, S.state.profile, S.state.resume) : null;
    var openTasks = S.state.tasks.filter(function (t) { return !t.done; });
    var pendingResume = S.state.favorites.filter(function (id) {
      return !S.state.resumeVersions.some(function (v) { return v.jobId === id; });
    }).length;

    var html = '' +
      '<div class="page-head-row mb-16">' +
        '<div class="page-head">' +
          '<h1>早上好，' + esc(S.state.profile.name) + ' 👋</h1>' +
          '<p>今天有新的岗位值得关注，继续推进你的秋招计划。' + esc(report.date) + ' · 按你的求职偏好筛选</p>' +
        '</div>' +
        '<div class="row">' +
          '<button class="btn" data-act="goto" data-view="profile">调整求职偏好</button>' +
          '<button class="btn btn-primary" data-act="import-job">' + UI.icon('plus') + '导入岗位</button>' +
        '</div>' +
      '</div>' +

      '<div class="grid grid-4 mb-16">' +
        statCard('今日新增岗位', report.newJobs, '条招聘线索 · 含社区来源待核验', 'radar', '') +
        statCard('高匹配岗位', report.highMatch, '匹配度 ≥ ' + (D.META.highMatchThreshold || 72) + ' 分（基于你的画像）', 'spark', 'accent') +
        statCard('待优化简历', pendingResume, '已收藏但尚未生成定制版本', 'doc', 'warn') +
        statCard('近期面试', st.interviewing, '进行中的面试进度', 'chat', 'good') +
      '</div>' +

      '<div class="grid grid-2 mb-16" style="grid-template-columns:minmax(0,1.55fr) minmax(0,1fr)">' +
        '<section class="card card-pad">' +
          '<h3 class="card-title">' + UI.icon('spark') + '为你推荐 <span class="sub">基于「个人画像 × 岗位 JD」计算</span>' +
            '<span class="right"><a class="small" href="#/radar">查看全部岗位 →</a></span></h3>' +
          (top ? recommendCard(top.job, topMatch) : '<div class="empty">暂无推荐</div>') +
        '</section>' +

        '<section class="card card-pad">' +
          '<h3 class="card-title">' + UI.icon('calendar') + '近期截止 <span class="sub">14 天内</span></h3>' +
          (report.upcoming.length ? report.upcoming.slice(0, 4).map(function (j) {
            return '<div class="row mb-12" style="gap:10px;align-items:flex-start">' + logoBox(j, 32) +
              '<div style="flex:1 1 auto;min-width:0">' +
                '<div class="strong small">' + jobLink(j, 'job-title small') + '</div>' +
                '<div class="tiny muted">' + esc(j.company) + ' · ' + esc(j.city) + '</div>' +
              '</div>' +
              '<span class="badge badge-warn nowrap">' + deadlineText(j) + '</span>' +
            '</div>';
          }).join('') : '<div class="empty small">近 14 天没有已知截止的岗位</div>') +
        '</section>' +
      '</div>' +

      '<div class="grid grid-2" style="grid-template-columns:minmax(0,1.55fr) minmax(0,1fr)">' +
        '<section class="card card-pad">' +
          '<h3 class="card-title">' + UI.icon('chart') + '秋招日报 <span class="sub">每日更新</span>' +
            '<span class="right"><a class="small" href="#/radar">进入招聘雷达 →</a></span></h3>' +
          '<div class="grid grid-3 mb-12">' +
            miniStat(report.newJobs, '新增招聘线索') +
            miniStat(report.highMatch, '高匹配岗位') +
            miniStat(report.deadlines, '待处理截止日期') +
          '</div>' +
          '<table class="table table-hover"><thead><tr><th>岗位</th><th>匹配度</th><th>来源</th><th>截止</th></tr></thead><tbody>' +
          report.topPicks.map(function (p) {
            return '<tr><td><div class="strong small">' + jobLink(p.job, 'job-title small') + '</div>' +
              '<div class="tiny muted">' + esc(p.job.company) + ' · ' + esc(p.job.city) + '</div></td>' +
              '<td><b style="color:' + matchColor(p.match.score) + '">' + p.match.score + '%</b></td>' +
              '<td class="tiny">' + sourceBadge(p.job) + '</td>' +
              '<td class="tiny muted">' + esc(deadlineText(p.job)) + '</td></tr>';
          }).join('') +
          '</tbody></table>' +
        '</section>' +

        '<section class="card card-pad">' +
          '<h3 class="card-title">' + UI.icon('check') + '近期待办 <span class="right"><a class="small" href="#/progress">进度中心 →</a></span></h3>' +
          (openTasks.length ? openTasks.slice(0, 4).map(function (t) {
            return '<div class="row mb-12" style="align-items:flex-start;gap:10px">' +
              '<span class="badge ' + (t.priority === 'high' ? 'badge-danger' : t.priority === 'low' ? 'badge-muted' : 'badge-warn') + '" style="margin-top:2px">' +
                (t.priority === 'high' ? '高' : t.priority === 'low' ? '低' : '中') + '</span>' +
              '<div style="flex:1 1 auto">' +
                '<div class="small strong">' + esc(t.title) + '</div>' +
                '<div class="tiny muted">' + (t.jobId && S.jobById(t.jobId) ? esc(S.jobById(t.jobId).company) + ' · ' : '') + esc(t.due || '') + '</div>' +
              '</div></div>';
          }).join('') : '<div class="empty small">暂无待办</div>') +
          '<div class="notice info mt-12">' + UI.icon('info') +
            '<div>产品原则：<b>信息可追溯</b>（保留来源与核验时间）、<b>内容可核验</b>（AI 不编造经历）、<b>用户可控</b>（投递需你确认）。</div>' +
          '</div>' +
        '</section>' +
      '</div>';

    return { html: html, mount: function () {} };
  };

  function statCard(label, num, hint, icon, cls) {
    return '<div class="stat ' + cls + '">' +
      '<div class="stat-ico">' + UI.icon(icon) + '</div>' +
      '<div class="label">' + esc(label) + '</div>' +
      '<div class="num">' + num + '</div>' +
      '<div class="hint">' + esc(hint) + '</div>' +
      '</div>';
  }

  function miniStat(num, label) {
    return '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:11px 13px">' +
      '<div style="font-size:22px;font-weight:650;letter-spacing:-.5px">' + num + '</div>' +
      '<div class="tiny muted">' + esc(label) + '</div></div>';
  }

  function recommendCard(job, m) {
    return '<div class="row" style="gap:14px;align-items:flex-start">' +
      logoBox(job, 52) +
      '<div style="flex:1 1 auto;min-width:0">' +
        '<div class="row" style="gap:8px"><a class="job-title" href="#/job/' + job.id + '">' + esc(job.company) + '｜' + esc(job.title) + '</a></div>' +
        '<div class="job-meta mt-8">' + jobMetaLine(job) + '</div>' +
        '<div class="row row-wrap mt-8" style="gap:6px">' + statusBadge(job) + sourceBadge(job) +
          '<span class="badge badge-purple">高匹配</span>' +
          (job.status !== 'open' || (job.sources || []).every(function (s) { return /公众号|小红书|分享|线索/.test(s.channel); })
            ? '<span class="badge badge-warn">官方来源待核验</span>' : '') +
        '</div>' +
      '</div>' +
      ring(m.score) +
      '</div>' +
      '<div class="analysis-block mt-16"><h4>推荐理由</h4><div class="small" style="color:var(--text-2)">' + esc(m.reason) + '</div></div>' +
      '<div class="row">' +
        '<button class="btn btn-primary btn-sm" data-act="goto" data-view="job" data-id="' + job.id + '">查看岗位</button>' +
        '<button class="btn btn-sm" data-act="tailor" data-id="' + job.id + '">定制简历</button>' +
        '<button class="btn btn-sm btn-ghost" data-act="interview-for" data-id="' + job.id + '">准备面试</button>' +
      '</div>';
  }

  /* ============================ 招聘雷达 ============================ */

  var radarState = { q: '', city: 'all', direction: 'all', degree: 'all', source: 'all', status: 'all', onlyFav: false, sort: 'match', minMatch: 0 };

  Views.radar = function () {
    var jobs = filteredJobs(radarState);
    var cities = E.uniq(S.state.jobs.reduce(function (a, j) { return a.concat(j.cities || [j.city]); }, []));
    var directions = E.uniq(S.state.jobs.map(function (j) { return j.direction; }));
    var degrees = E.uniq(S.state.jobs.map(function (j) { return j.degree; }));

    /* 计算匹配度并排序 */
    var scored = jobs.map(function (j) {
      return { job: j, match: E.matchJob(j, S.state.profile, S.state.resume) };
    }).filter(function (x) { return x.match.score >= (radarState.minMatch || 0); });

    scored.sort(function (a, b) {
      if (radarState.sort === 'match') return b.match.score - a.match.score;
      if (radarState.sort === 'deadline') {
        var da = a.job.deadline && a.job.deadline !== '待官方确认' ? new Date(a.job.deadline) : Infinity;
        var db = b.job.deadline && b.job.deadline !== '待官方确认' ? new Date(b.job.deadline) : Infinity;
        return da - db;
      }
      return (b.job.id > a.job.id ? 1 : -1);
    });

    var html = '' +
      '<div class="page-head-row mb-16">' +
        '<div class="page-head"><h1>招聘雷达</h1>' +
          '<p>多渠道招聘信息聚合 · 每日更新 · 同一职位重复出现时合并为一条记录并保留多个来源</p></div>' +
        '<div class="row">' +
          '<button class="btn" data-act="import-job">' + UI.icon('plus') + '手动导入招聘链接 / 文本</button>' +
        '</div>' +
      '</div>' +

      '<div class="grid grid-radar">' +
        '<aside class="card card-pad filters">' +
          '<div class="row mb-12"><b style="font-size:13.5px">筛选条件</b>' +
            '<span class="spacer"></span><button class="btn btn-sm btn-ghost" data-act="radar-reset">清除</button></div>' +

          '<div class="filter-block"><h4>岗位方向</h4>' + filterChips('direction', directions, radarState.direction, '全部方向') + '</div>' +
          '<div class="filter-block"><h4>工作城市</h4>' + filterChips('city', cities, radarState.city, '全部城市') + '</div>' +
          '<div class="filter-block"><h4>学历要求</h4>' + filterChips('degree', degrees, radarState.degree, '不限') + '</div>' +
          '<div class="filter-block"><h4>信息来源</h4>' + filterChips('source', [], radarState.source, '全部') +
            '<div class="chips mt-8"><button class="chip' + (radarState.source === 'official' ? ' on' : '') + '" data-chipgroup="source-force" data-chip="official">仅官方来源</button>' +
            '<button class="chip' + (radarState.source === 'community' ? ' on' : '') + '" data-chipgroup="source-force" data-chip="community">仅社区线索</button></div></div>' +
          '<div class="filter-block"><h4>招聘状态</h4>' +
            '<div class="chips"><button class="chip' + (radarState.status === 'all' ? ' on' : '') + '" data-chipgroup="status" data-chip="all">全部</button>' +
            '<button class="chip' + (radarState.status === 'open' ? ' on' : '') + '" data-chipgroup="status" data-chip="open">招聘中</button>' +
            '<button class="chip' + (radarState.status === 'closed' ? ' on' : '') + '" data-chipgroup="status" data-chip="closed">已截止</button>' +
            '<button class="chip' + (radarState.status === 'unknown' ? ' on' : '') + '" data-chipgroup="status" data-chip="unknown">状态待确认</button></div></div>' +

          '<div class="filter-block"><h4>匹配度下限：<b id="minMatchLabel">' + radarState.minMatch + '</b> 分</h4>' +
            '<input type="range" min="0" max="90" step="5" value="' + radarState.minMatch + '" id="minMatchRange" style="width:100%"></div>' +

          '<label class="row small" style="cursor:pointer"><input type="checkbox" id="onlyFav"' + (radarState.onlyFav ? ' checked' : '') + '> 只看我收藏的岗位</label>' +
        '</aside>' +

        '<section>' +
          '<div class="row mb-12">' +
            '<div class="small muted">共 <b style="color:var(--text)">' + scored.length + '</b> 个岗位' +
              (radarState.q ? ' · 搜索词「<b style="color:var(--text)">' + esc(radarState.q) + '</b>」<button class="btn btn-sm btn-ghost" data-act="clear-search" style="padding:2px 8px">清除</button>' : '') +
              ' · 数据为示例，实际投递前请以官方页面为准</div>' +
            '<span class="spacer"></span>' +
            '<select class="select" id="radarSort" style="width:auto">' +
              '<option value="match"' + (radarState.sort === 'match' ? ' selected' : '') + '>按匹配度排序</option>' +
              '<option value="deadline"' + (radarState.sort === 'deadline' ? ' selected' : '') + '>按截止时间排序</option>' +
              '<option value="new"' + (radarState.sort === 'new' ? ' selected' : '') + '>按新增排序</option>' +
            '</select>' +
          '</div>' +
          (scored.length ? scored.map(function (x) { return jobCard(x.job, x.match); }).join('') :
            '<div class="card empty"><div class="empty-ico">' + UI.icon('search') + '</div><b>没有符合条件的岗位</b>' +
            '<div class="small">试着放宽筛选条件，或手动导入一条招聘信息。</div>' +
            '<div class="mt-16"><button class="btn btn-primary btn-sm" data-act="radar-reset">清除筛选</button></div></div>') +
        '</section>' +
      '</div>';

    return {
      html: html,
      mount: function (root) {
        root.querySelectorAll('.chip[data-chip]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var box = btn.closest('[data-chipgroup]');
            var g = box ? box.getAttribute('data-chipgroup') : btn.getAttribute('data-chipgroup');
            var v = btn.getAttribute('data-chip');
            if (g === 'source-force') radarState.source = radarState.source === v ? 'all' : v;
            else if (g === 'direction') radarState.direction = v;
            else if (g === 'city') radarState.city = v;
            else if (g === 'degree') radarState.degree = v;
            else if (g === 'status') radarState.status = v;
            else if (g === 'source') radarState.source = v;
            window.App.rerender();
          });
        });
        var range = root.querySelector('#minMatchRange');
        if (range) {
          range.addEventListener('input', function () {
            radarState.minMatch = Number(range.value);
            var lbl = root.querySelector('#minMatchLabel');
            if (lbl) lbl.textContent = range.value;
          });
          range.addEventListener('change', function () { window.App.rerender(); });
        }
        var fav = root.querySelector('#onlyFav');
        if (fav) fav.addEventListener('change', function () { radarState.onlyFav = fav.checked; window.App.rerender(); });
        var sort = root.querySelector('#radarSort');
        if (sort) sort.addEventListener('change', function () { radarState.sort = sort.value; window.App.rerender(); });
      }
    };
  };

  function jobCard(job, m) {
    var fav = S.isFavorite(job.id);
    var community = (job.sources || []).length && (job.sources || []).every(function (s) {
      return /公众号|小红书|论坛|分享|线索|用户/.test(s.channel);
    });
    return '<article class="job-card">' +
      '<div class="job-card-head">' +
        logoBox(job) +
        '<div style="flex:1 1 auto;min-width:0">' +
          '<div class="row" style="gap:8px;flex-wrap:wrap">' +
            jobLink(job) +
            statusBadge(job) + sourceBadge(job) + statusText(job) +
          '</div>' +
          '<div class="job-meta mt-8">' + jobMetaLine(job) + '</div>' +
        '</div>' +
        '<div style="text-align:center;flex:0 0 auto">' + ring(m.score, 52) +
          '<div class="tiny muted mt-8">匹配度</div></div>' +
      '</div>' +
      '<div class="small mt-12" style="color:var(--text-2)">' + esc(m.reason) + '</div>' +
      '<div class="row row-wrap mt-8" style="gap:6px">' +
        m.matchedSkills.slice(0, 4).map(function (s) { return '<span class="badge badge-success">命中 · ' + esc(s) + '</span>'; }).join('') +
        m.missingSkills.slice(0, 3).map(function (s) { return '<span class="badge badge-warn">差距 · ' + esc(s) + '</span>'; }).join('') +
      '</div>' +
      (community ? '<div class="notice mt-12">' + UI.icon('alert') + '<div>该岗位目前来源于社区分享线索，<b>尚未在官方渠道核验</b>，请以企业官方页面为准。</div></div>' : '') +
      (job.needsReview ? '<div class="notice mt-12">' + UI.icon('alert') + '<div>该岗位由 AI 从你导入的文本中解析生成，公司名称、截止时间等字段请人工核对。</div></div>' : '') +
      '<div class="source-line">' +
        '<span class="src">' + UI.icon('link') + '来源：' + (job.sources || []).map(function (s) { return esc(s.channel); }).join(' / ') + '</span>' +
        (job.sources && job.sources[0] ? '<span class="src">最近核验：' + esc(job.sources[0].verifiedAt) + '</span>' : '') +
        '<span class="src">' + esc(deadlineText(job)) + '</span>' +
      '</div>' +
      '<div class="row mt-12">' +
        '<button class="btn btn-sm btn-primary" data-act="goto" data-view="job" data-id="' + job.id + '">查看岗位</button>' +
        '<button class="btn btn-sm" data-act="tailor" data-id="' + job.id + '">定制简历</button>' +
        '<button class="btn btn-sm" data-act="interview-for" data-id="' + job.id + '">准备面试</button>' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-sm ' + (fav ? '' : 'btn-ghost') + '" data-act="fav" data-id="' + job.id + '">' +
          (fav ? '★ 已收藏' : '☆ 收藏') + '</button>' +
      '</div>' +
    '</article>';
  }

  /* ============================ 岗位详情 ============================ */

  Views.job = function (params) {
    var job = S.jobById(params.id);
    if (!job) return { html: '<div class="card empty"><b>岗位不存在或已被移除</b><div class="small mt-8"><a href="#/radar">返回招聘雷达</a></div></div>', mount: function () {} };

    var m = E.matchJob(job, S.state.profile, S.state.resume);
    var app = S.applicationOf(job.id);
    var fav = S.isFavorite(job.id);
    var version = app && app.resumeVersionId ? S.versionById(app.resumeVersionId) : null;
    var reports = D.INTERVIEW_REPORTS.filter(function (r) { return r.jobId === job.id; });

    var html = '' +
      '<div class="row mb-16"><a class="btn btn-sm btn-ghost" href="#/radar">← 返回招聘雷达</a></div>' +

      '<div class="detail-hero mb-16">' +
        '<div class="row" style="gap:16px;align-items:flex-start">' +
          logoBox(job, 56) +
          '<div style="flex:1 1 auto;min-width:0">' +
            '<h1 style="margin:0 0 6px;font-size:22px">' + esc(job.title) + '</h1>' +
            '<div class="job-meta">' +
              '<span class="strong" style="color:var(--text)">' + esc(job.company) + '</span>' +
              '<span>' + esc(job.industry) + '</span>' +
              '<span>' + esc(job.city) + '</span>' +
              '<span>' + esc(job.degree) + '</span>' +
              '<span>' + esc(job.batch) + '</span>' +
              '<span>' + esc(job.salary) + '</span>' +
            '</div>' +
            '<div class="row row-wrap mt-12" style="gap:6px">' + statusBadge(job) + sourceBadge(job) + statusText(job) +
              '<span class="badge">' + esc(deadlineText(job)) + '</span></div>' +
          '</div>' +
          '<div style="text-align:center">' + ring(m.score, 64) + '<div class="tiny muted mt-8">匹配度</div></div>' +
        '</div>' +
        '<div class="row row-wrap mt-16">' +
          '<button class="btn btn-primary" data-act="tailor" data-id="' + job.id + '">' + UI.icon('doc') + '定制简历</button>' +
          '<button class="btn" data-act="interview-for" data-id="' + job.id + '">' + UI.icon('chat') + '准备面试</button>' +
          (app && app.stage !== 'saved'
            ? '<button class="btn" data-act="goto" data-view="progress">已在进度中心 · ' + esc(S.stageMeta(app.stage).label) + '</button>'
            : '<button class="btn" data-act="confirm-apply" data-id="' + job.id + '">' + UI.icon('check') + '确认投递</button>') +
          '<span class="spacer"></span>' +
          '<button class="btn ' + (fav ? '' : 'btn-ghost') + '" data-act="fav" data-id="' + job.id + '">' + (fav ? '★ 已收藏' : '☆ 收藏') + '</button>' +
        '</div>' +
      '</div>' +

      ((job.needsReview || (job.sources || []).every(function (s) { return /公众号|小红书|论坛|分享|线索|用户|手动导入/.test(s.channel); }))
        ? '<div class="notice mb-16">' + UI.icon('alert') +
          '<div>' + (job.needsReview
            ? '该岗位由 AI 从你导入的文本中解析生成，公司名称、岗位名称与截止时间等字段<b>请人工核对</b>后再作为投递依据。'
            : '该岗位目前来源于社区线索，<b>尚未在官方渠道核验</b>，请以企业官方招聘页面为准。') + '</div></div>'
        : '') +

      '<div class="grid" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);align-items:start">' +
        '<div>' +
          '<section class="card card-pad mb-16">' +
            '<h3 class="card-title">' + UI.icon('doc') + '岗位职责</h3>' +
            '<ul class="list-check">' + (job.responsibilities || []).map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' +
            '<h3 class="card-title mt-24">' + UI.icon('check') + '任职要求</h3>' +
            '<ul class="list-check">' + (job.requirements || []).map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' +
            (job.nice && job.nice.length ? '<h3 class="card-title mt-24">加分项</h3><ul class="list-check">' +
              job.nice.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' : '') +
            (job.raw ? '<h3 class="card-title mt-24">导入的原始文本</h3><div class="small muted" style="white-space:pre-wrap;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:12px;max-height:220px;overflow:auto">' + esc(job.raw) + '</div>' : '') +
          '</section>' +

          '<section class="card card-pad mb-16">' +
            '<h3 class="card-title">' + UI.icon('spark') + 'AI 岗位匹配分析 <span class="sub">不只看分数，更解释为什么</span></h3>' +
            '<div class="row mb-16" style="gap:14px;align-items:center">' + ring(m.score, 56) +
              '<div><div class="strong">' + (m.score >= 85 ? '高度匹配' : m.score >= 72 ? '较为匹配' : '存在一定差距') + '</div>' +
              '<div class="small muted">' + esc(m.reason) + '</div></div></div>' +

            '<div class="analysis-block"><h4>匹配优势（' + m.advantages.length + '）</h4>' +
              (m.advantages.length ? m.advantages.slice(0, 5).map(function (a) {
                return '<div class="mb-12"><div class="row" style="gap:6px">' + UI.icon('check') +
                  '<b class="small">' + esc(a.skill) + '</b></div>' +
                  a.evidence.map(function (ev) {
                    return '<div class="evidence"><span class="tag">来自你的简历 · ' + esc(ev.section) + '</span>' + esc(ev.text) + '</div>';
                  }).join('') + '</div>';
              }).join('') : '<div class="small muted">暂未找到直接对应的经历证据。</div>') +
            '</div>' +

            '<div class="analysis-block gap"><h4>能力差距（' + m.gaps.length + '）</h4>' +
              (m.gaps.length ? '<ul class="list-check gap">' + m.gaps.map(function (g) {
                return '<li><b>' + esc(g.skill) + '</b>：' + esc(g.desc) + '</li>';
              }).join('') + '</ul>' : '<div class="small muted">未发现明显的能力缺口。</div>') +
            '</div>' +

            '<div class="analysis-block next"><h4>下一步建议</h4>' +
              '<ul class="list-check">' + m.suggestions.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
              '<div class="row mt-12"><button class="btn btn-primary btn-sm" data-act="tailor" data-id="' + job.id + '">按建议生成定制简历</button></div>' +
            '</div>' +
          '</section>' +

          '<section class="card card-pad">' +
            '<h3 class="card-title">' + UI.icon('link') + '信息来源与核验 <span class="sub">信息可追溯</span></h3>' +
            (job.sources || []).map(function (s) {
              var isOfficial = /官网|官方|校园招聘平台|企业招聘/.test(s.channel);
              return '<div class="row mb-12" style="align-items:flex-start;gap:10px">' +
                '<span style="margin-top:3px">' + (isOfficial ? UI.icon('shield') : UI.icon('alert')) + '</span>' +
                '<div style="flex:1 1 auto;min-width:0">' +
                  '<div class="strong small">' + esc(s.channel) + ' ' + (isOfficial ? '<span class="badge badge-success">官方信息</span>' : '<span class="badge badge-warn">社区线索 · 非官方</span>') + '</div>' +
                  '<div class="tiny muted">发布时间：' + esc(s.publishedAt || '未知') + ' · 最近核验：' + esc(s.verifiedAt || '未知') + '</div>' +
                  (s.url ? '<div class="tiny"><a class="link-mock" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.url) + '</a></div>' : '') +
                '</div></div>';
            }).join('') +
            '<div class="notice mt-12">' + UI.icon('alert') + '<div>产品不会把社区传言当作企业正式通知，也不会因为你投递后没有收到消息就推断你已被拒绝。</div></div>' +
          '</section>' +
        '</div>' +

        '<div>' +
          '<section class="card card-pad mb-16">' +
            '<h3 class="card-title">' + UI.icon('chart') + '我的进度</h3>' +
            '<div class="field"><label>当前状态</label>' +
              '<select class="select" id="stageSelect">' +
                S.STAGES.map(function (s) {
                  var cur = app ? app.stage : 'saved';
                  return '<option value="' + s.id + '"' + (cur === s.id ? ' selected' : '') + '>' + esc(s.label) + '</option>';
                }).join('') +
              '</select></div>' +
            '<div class="field"><label>备注</label>' +
              '<textarea class="textarea" id="appNote" style="min-height:64px" placeholder="例如：已约一面，时间是 10/10 14:00">' + esc(app ? app.note : '') + '</textarea></div>' +
            '<button class="btn btn-primary btn-block" data-act="save-stage" data-id="' + job.id + '">保存进度</button>' +
            '<div class="tiny muted mt-12">投递信息、简历版本、岗位 JD 与来源会绑定在同一条岗位档案下。</div>' +
          '</section>' +

          '<section class="card card-pad mb-16">' +
            '<h3 class="card-title">' + UI.icon('doc') + '岗位简历版本</h3>' +
            (version ? '<div class="small">当前绑定：<b>' + esc(version.title) + '</b><div class="tiny muted">创建于 ' + esc(version.createdAt) + '</div>' +
              '<div class="mt-12"><a class="btn btn-sm" href="#/resume/' + version.id + '">查看定制内容</a></div></div>'
              : '<div class="small muted">尚未为该岗位生成定制简历。每份定制简历都会独立保存，修改通用简历不会影响已投递的版本。</div>' +
                '<div class="mt-12"><button class="btn btn-primary btn-sm" data-act="tailor" data-id="' + job.id + '">生成定制简历</button></div>') +
          '</section>' +

          '<section class="card card-pad mb-16">' +
            '<h3 class="card-title">' + UI.icon('chat') + '公开面经 <span class="sub">' + reports.length + ' 条</span></h3>' +
            (reports.length ? reports.map(function (r) {
              return '<div class="mb-12"><div class="row" style="gap:6px"><span class="badge badge-purple">' + esc(r.stage) + '</span>' +
                '<span class="tiny muted">' + esc(r.source) + ' · ' + esc(r.publishedAt) + '</span></div>' +
                '<div class="small mt-8">共 ' + r.questions.length + ' 道题</div>' +
                '<div class="tiny muted">' + esc(r.reliability) + '</div></div>';
            }).join('') + '<button class="btn btn-sm btn-primary" data-act="interview-for" data-id="' + job.id + '">用面经生成面试题</button>'
              : '<div class="small muted">暂未找到该岗位的公开面经，仍可基于 JD 生成预测问题。</div>' +
                '<div class="mt-12"><button class="btn btn-sm" data-act="interview-for" data-id="' + job.id + '">生成预测问题</button></div>') +
          '</section>' +

          '<section class="card card-pad">' +
            '<h3 class="card-title">' + UI.icon('clock') + '进度时间线</h3>' +
            (app && app.timeline && app.timeline.length
              ? '<div class="timeline">' + app.timeline.slice().reverse().map(function (t) {
                  return '<div class="tl-item"><div class="strong small">' + esc(t.type) + '</div>' +
                    '<div class="small" style="color:var(--text-2)">' + esc(t.text) + '</div>' +
                    '<div class="tl-ts">' + esc(t.ts) + '</div></div>';
                }).join('') + '</div>'
              : '<div class="small muted">还没有记录。收藏或更新状态后会自动生成时间线。</div>') +
          '</section>' +
        '</div>' +
      '</div>';

    return {
      html: html,
      mount: function (root) {
        var sel = root.querySelector('#stageSelect');
        if (sel) sel.addEventListener('change', function () {
          S.setStage(job.id, sel.value, (root.querySelector('#appNote') || {}).value);
          UI.toast('已更新为「' + S.stageMeta(sel.value).label + '」', 'ok');
          window.App.rerender();
        });
      }
    };
  };

  /* 供 app.js 与其他视图复用 */
  Views._helpers = { esc: esc, ring: ring, matchColor: matchColor, jobLink: jobLink, logoBox: logoBox,
    statusBadge: statusBadge, sourceBadge: sourceBadge, deadlineText: deadlineText, jobMetaLine: jobMetaLine,
    stageBadge: stageBadge, statCard: statCard, escHtml: esc };
  Views._radarState = radarState;

  window.Views = Views;
})(window);
