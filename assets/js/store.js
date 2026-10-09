/* ------------------------------------------------------------------
 * store.js — 统一状态管理 + 本地持久化
 * 所有模块读写同一份状态，保证「以岗位为中心」的数据链路真正串联。
 * ---------------------------------------------------------------- */
(function (window) {
  'use strict';

  var D = window.AIData;
  var KEY = 'qiuzhao-radar-state-v1';

  var STAGES = [
    { id: 'saved', label: '已收藏', color: '#8a93a6' },
    { id: 'applied', label: '已投递', color: '#4f7cff' },
    { id: 'written', label: '笔试', color: '#9a6bff' },
    { id: 'interview', label: '面试中', color: '#f2994a' },
    { id: 'offer', label: 'Offer', color: '#27ae60' },
    { id: 'rejected', label: '已结束', color: '#c0392b' }
  ];

  var listeners = [];
  var state = null;

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /* --------------------------- 初始状态 --------------------------- */
  function seedState() {
    var s = {
      version: 1,
      onboarded: false,
      profile: clone(D.DEFAULT_PROFILE),
      resume: clone(D.DEFAULT_RESUME),
      jobs: clone(D.JOBS),
      favorites: ['job-1', 'job-2', 'job-3', 'job-8', 'job-14'],
      applications: {
        'job-1': {
          jobId: 'job-1', stage: 'interview', appliedAt: '2026-09-30',
          resumeVersionId: 'ver-demo-1',
          note: '一面已约，准备项目深挖与需求优先级问题。',
          timeline: [
            { ts: '2026-09-28', type: '收藏', text: '在招聘雷达中收藏岗位' },
            { ts: '2026-09-30', type: '投递', text: '使用定制简历版本投递' },
            { ts: '2026-10-06', type: '笔试', text: '完成在线测评' },
            { ts: '2026-10-08', type: '面试', text: '收到一面邀请，时间待确认' }
          ]
        },
        'job-3': {
          jobId: 'job-3', stage: 'applied', appliedAt: '2026-10-05',
          resumeVersionId: null,
          note: '等待笔试通知。',
          timeline: [
            { ts: '2026-10-03', type: '收藏', text: '在招聘雷达中收藏岗位' },
            { ts: '2026-10-05', type: '投递', text: '通过企业招聘官网投递' }
          ]
        },
        'job-6': {
          jobId: 'job-6', stage: 'written', appliedAt: '2026-09-26',
          resumeVersionId: null,
          note: '笔试已完成，等结果。',
          timeline: [
            { ts: '2026-09-24', type: '收藏', text: '在招聘雷达中收藏岗位' },
            { ts: '2026-09-26', type: '投递', text: '通过企业招聘官网投递' },
            { ts: '2026-10-02', type: '笔试', text: '完成线上笔试' }
          ]
        }
      },
      resumeVersions: [
        {
          id: 'ver-demo-1',
          jobId: 'job-1',
          createdAt: '2026-09-30',
          title: '星野科技 · 产品经理（校招）定制版',
          changes: [],
          applied: true
        }
      ],
      interviewPlans: {},
      interviewSessions: [],
      tasks: [
        { id: 'task-1', title: '准备产品经理一面（项目深挖）', jobId: 'job-1', due: '2026-10-10', priority: 'high', done: false, type: '面试' },
        { id: 'task-2', title: '检查岗位定制简历是否已导出', jobId: 'job-3', due: '2026-10-11', priority: 'medium', done: false, type: '简历' },
        { id: 'task-3', title: '核验白鹭科技招聘截止时间（来源为社区线索）', jobId: 'job-11', due: '2026-10-12', priority: 'low', done: false, type: '信息核验' }
      ],
      settings: { useRemote: false, endpoint: '', apiKey: '', model: 'gpt-4o-mini' },
      activity: [
        { ts: '2026-10-08', text: 'AI 面试教练为「星野科技 · 产品经理」生成了问题清单' },
        { ts: '2026-10-06', text: '完成「谷雨科技 · 产品运营」线上笔试' }
      ],
      ui: { lastView: 'dashboard' }
    };
    return s;
  }

  /* --------------------------- 读写 --------------------------- */
  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return seedState();
      var parsed = JSON.parse(raw);
      var base = seedState();
      /* 浅合并，保证新增字段可用 */
      Object.keys(base).forEach(function (k) {
        if (parsed[k] === undefined) parsed[k] = base[k];
      });
      return parsed;
    } catch (e) {
      return seedState();
    }
  }

  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 隐私模式下静默失败 */ }
    listeners.forEach(function (fn) { try { fn(state); } catch (e) {} });
  }

  function subscribe(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }

  function reset() {
    state = seedState();
    save();
  }

  /* --------------------------- 派生数据 --------------------------- */
  function jobById(id) {
    return state.jobs.filter(function (j) { return j.id === id; })[0] || null;
  }

  function applicationOf(jobId) {
    return state.applications[jobId] || null;
  }

  function stageOf(jobId) {
    if (state.applications[jobId]) return state.applications[jobId].stage;
    if (state.favorites.indexOf(jobId) !== -1) return 'saved';
    return null;
  }

  function stageMeta(id) {
    return STAGES.filter(function (s) { return s.id === id; })[0] || STAGES[0];
  }

  function stats() {
    var apps = Object.keys(state.applications);
    var byStage = {};
    STAGES.forEach(function (s) { byStage[s.id] = 0; });
    apps.forEach(function (k) { byStage[state.applications[k].stage] = (byStage[state.applications[k].stage] || 0) + 1; });

    var openTasks = state.tasks.filter(function (t) { return !t.done; });
    var report = window.AIEngine.dailyReport(state.jobs, state.profile, state.resume);

    /* 按方向统计 */
    var byDirection = {};
    apps.forEach(function (k) {
      var j = jobById(k);
      if (!j) return;
      byDirection[j.direction] = (byDirection[j.direction] || 0) + 1;
    });

    return {
      favorites: state.favorites.length,
      applied: apps.length,
      interviewing: byStage.interview || 0,
      offers: byStage.offer || 0,
      tasks: openTasks.length,
      byStage: byStage,
      byDirection: byDirection,
      newJobs: report.newJobs,
      highMatch: report.highMatch,
      deadlines: report.deadlines
    };
  }

  /* --------------------------- 变更动作 --------------------------- */
  function logActivity(text) {
    state.activity.unshift({ ts: D.META.today, text: text });
    state.activity = state.activity.slice(0, 30);
  }

  function addJob(job) {
    state.jobs.unshift(job);
    logActivity('导入岗位「' + job.company + ' · ' + job.title + '」，字段由 AI 解析生成，需人工核对');
    save();
    return job;
  }

  function updateJob(jobId, patch) {
    var j = jobById(jobId);
    if (!j) return;
    Object.keys(patch).forEach(function (k) { j[k] = patch[k]; });
    save();
  }

  function removeJob(jobId) {
    state.jobs = state.jobs.filter(function (j) { return j.id !== jobId; });
    state.favorites = state.favorites.filter(function (id) { return id !== jobId; });
    delete state.applications[jobId];
    save();
  }

  function toggleFavorite(jobId) {
    var i = state.favorites.indexOf(jobId);
    if (i === -1) {
      state.favorites.push(jobId);
      if (!state.applications[jobId]) {
        state.applications[jobId] = {
          jobId: jobId, stage: 'saved', appliedAt: null, resumeVersionId: null,
          note: '', timeline: [{ ts: D.META.today, type: '收藏', text: '在招聘雷达中收藏岗位' }]
        };
      }
      logActivity('收藏岗位「' + (jobById(jobId) || {}).title + '」');
    } else {
      state.favorites.splice(i, 1);
      if (state.applications[jobId] && state.applications[jobId].stage === 'saved') delete state.applications[jobId];
    }
    save();
    return i === -1;
  }

  function isFavorite(jobId) { return state.favorites.indexOf(jobId) !== -1; }

  function setStage(jobId, stage, note) {
    var app = state.applications[jobId];
    if (!app) {
      app = { jobId: jobId, stage: null, appliedAt: null, resumeVersionId: null, note: '', timeline: [] };
      state.applications[jobId] = app;
    }
    var prev = app.stage || 'saved';
    app.stage = stage;
    if (stage === 'applied' && !app.appliedAt) app.appliedAt = D.META.today;
    app.timeline = app.timeline || [];
    if (prev !== stage) {
      app.timeline.push({ ts: D.META.today, type: stageMeta(stage).label, text: '状态更新：' + stageMeta(prev).label + ' → ' + stageMeta(stage).label + (note ? '（' + note + '）' : '') });
    }
    if (note) app.note = note;
    if (state.favorites.indexOf(jobId) === -1) state.favorites.push(jobId);
    logActivity('「' + (jobById(jobId) || {}).title + '」状态更新为「' + stageMeta(stage).label + '」');
    save();
  }

  function updateApplication(jobId, patch) {
    var app = state.applications[jobId];
    if (!app) return;
    Object.keys(patch).forEach(function (k) { app[k] = patch[k]; });
    save();
  }

  /* --------------------------- 简历版本 --------------------------- */
  function createResumeVersion(jobId, changes, title) {
    var job = jobById(jobId);
    var ver = {
      id: 'ver-' + Date.now(),
      jobId: jobId,
      createdAt: D.META.today,
      title: title || ((job ? job.company + ' · ' + job.title : '未命名岗位') + ' 定制版'),
      changes: changes,
      applied: false
    };
    state.resumeVersions.unshift(ver);
    if (state.applications[jobId]) state.applications[jobId].resumeVersionId = ver.id;
    logActivity('为「' + (job ? job.title : '') + '」生成定制简历，共 ' + changes.length + ' 条修改建议');
    save();
    return ver;
  }

  function versionById(id) {
    return state.resumeVersions.filter(function (v) { return v.id === id; })[0] || null;
  }

  function updateChange(versionId, changeId, status, editedText) {
    var ver = versionById(versionId);
    if (!ver) return;
    ver.changes.forEach(function (c) {
      if (c.id === changeId) {
        c.status = status;
        if (editedText !== undefined) c.after = editedText;
      }
    });
    save();
  }

  /* --------------------------- 面试 --------------------------- */
  function setInterviewPlan(jobId, plan) {
    state.interviewPlans[jobId] = plan;
    logActivity('AI 面试教练为「' + (jobById(jobId) || {}).title + '」生成 ' + plan.total + ' 道面试题');
    save();
  }

  function addSession(session) {
    session.id = 'sess-' + Date.now();
    state.interviewSessions.unshift(session);
    save();
    return session;
  }

  /* --------------------------- 待办 --------------------------- */
  function addTask(task) {
    task.id = 'task-' + Date.now();
    task.done = false;
    state.tasks.unshift(task);
    save();
    return task;
  }

  function toggleTask(id) {
    state.tasks.forEach(function (t) { if (t.id === id) t.done = !t.done; });
    save();
  }

  function removeTask(id) {
    state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
    save();
  }

  /* --------------------------- 画像 / 简历 --------------------------- */
  function updateProfile(patch) {
    Object.keys(patch).forEach(function (k) { state.profile[k] = patch[k]; });
    save();
  }

  function updateResume(resume) {
    state.resume = resume;
    state.resume.updatedAt = D.META.today;
    save();
  }

  function updateSettings(patch) {
    Object.keys(patch).forEach(function (k) { state.settings[k] = patch[k]; });
    save();
  }

  function setOnboarded(v) {
    state.onboarded = !!v;
    save();
  }

  function setUI(patch) {
    state.ui = state.ui || {};
    Object.keys(patch).forEach(function (k) { state.ui[k] = patch[k]; });
    save();
  }

  state = load();

  window.Store = {
    STAGES: STAGES,
    get state() { return state; },
    save: save,
    subscribe: subscribe,
    reset: reset,
    jobById: jobById,
    applicationOf: applicationOf,
    stageOf: stageOf,
    stageMeta: stageMeta,
    stats: stats,
    addJob: addJob,
    updateJob: updateJob,
    removeJob: removeJob,
    toggleFavorite: toggleFavorite,
    isFavorite: isFavorite,
    setStage: setStage,
    updateApplication: updateApplication,
    createResumeVersion: createResumeVersion,
    versionById: versionById,
    updateChange: updateChange,
    setInterviewPlan: setInterviewPlan,
    addSession: addSession,
    addTask: addTask,
    toggleTask: toggleTask,
    removeTask: removeTask,
    updateProfile: updateProfile,
    updateResume: updateResume,
    updateSettings: updateSettings,
    setOnboarded: setOnboarded,
    setUI: setUI,
    logActivity: logActivity
  };
})(window);
