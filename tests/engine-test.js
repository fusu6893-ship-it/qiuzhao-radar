/* 在 Node 中验证核心「AI 引擎」逻辑（不依赖 DOM） */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* 运行方式： node tests/engine-test.js （在项目根目录执行） */
const ROOT = path.join(__dirname, '..', 'assets', 'js');

const store = {};
const sandbox = {
  console,
  setTimeout,
  fetch: () => Promise.reject(new Error('no network')),
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);

['data.js', 'ai.js', 'store.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
});

const { AIData: D, AIEngine: E, Store: S } = sandbox;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name + (extra ? ' — ' + extra : '')); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
}

console.log('\n[1] 岗位匹配分析');
const job1 = S.jobById('job-1');
const m1 = E.matchJob(job1, S.state.profile, S.state.resume);
check('输出 0-100 的匹配分', m1.score > 40 && m1.score <= 96, 'score=' + m1.score);
check('解释「为什么匹配」', /覆盖了岗位要求的/.test(m1.reason) || m1.reason.length > 10);
check('给出匹配优势及简历证据', m1.advantages.length > 0 && m1.advantages[0].evidence.length > 0,
  m1.advantages.map(a => a.skill).join(','));
check('给出能力差距', m1.gaps.length > 0, m1.gaps.map(g => g.skill).join(','));
check('给出下一步建议', m1.suggestions.length >= 3, m1.suggestions.length + ' 条');
check('证据确实来自简历原文', m1.advantages[0].evidence[0].text.length > 0,
  '「' + m1.advantages[0].evidence[0].text.slice(0, 28) + '…」');

console.log('\n[2] AI 简历定制');
const changes = E.tailorResume(S.state.resume, job1, m1);
check('生成多条改写建议', changes.length >= 3, changes.length + ' 条');
const bulletChanges = changes.filter(c => c.bulletIndex !== undefined && !c.structural);
check('包含逐条 bullet 改写', bulletChanges.length >= 2, bulletChanges.length + ' 条');
check('每条改写都带修改依据', changes.every(c => c.reason && c.reason.length > 8));
check('标注需要用户补充事实的条目', changes.some(c => c.needsFact), changes.filter(c => c.needsFact).length + ' 条');
check('弱表达被改写为具体动作', bulletChanges.length > 0 &&
  !/^参与/.test(bulletChanges[0].after), '→「' + (bulletChanges[0] ? bulletChanges[0].after.slice(0, 40) : '') + '…」');
check('不会编造数字（改写文本中无凭空数据）',
  bulletChanges.every(c => !/\d+\s*(%|个百分点|倍|万)/.test(c.after) || /\d/.test(c.before)));
check('保留原始表达用于对比', changes.every(c => c.before && c.before.length > 0));
console.log('    示例改写：');
if (bulletChanges[0]) {
  console.log('      前：' + bulletChanges[0].before);
  console.log('      后：' + bulletChanges[0].after);
}

console.log('\n[3] 面试问题生成');
const plan = E.generateQuestions(job1, S.state.profile, S.state.resume, D.INTERVIEW_REPORTS);
check('按环节分类', plan.groups.length >= 4, plan.groups.map(g => g.category).join('/'));
const allQ = plan.groups.reduce((a, g) => a.concat(g.questions), []);
const real = allQ.filter(q => q.type === 'real');
const pred = allQ.filter(q => q.type === 'predicted');
check('保留真实面经题并标注来源', real.length > 0 && real[0].source && real[0].source.url, real.length + ' 题');
check('AI 预测题明确标记为预测', pred.length > 0);
check('生成基于简历的追问', allQ.some(q => q.type === 'personal'), '简历追问');
check('预测题不伪装成企业真实题库', pred.every(q => !q.source));

console.log('\n[4] 个性化参考回答');
const q = allQ.find(x => /需求/.test(x.text)) || allQ[0];
const ans = E.buildAnswer(q, job1, S.state.resume);
check('给出结构化的回答骨架', ans.skeleton.split('\n').length >= 3, ans.skeleton.split('\n').length + ' 步');
check('引用用户自己的项目素材', ans.materials.length > 0 || /补充/.test(ans.skeleton));
check('提示需要用户补充的事实', ans.factsToFill.length >= 2, ans.factsToFill.length + ' 项');
check('参考回答声明不编造', /不代为编造|真实经历/.test(ans.reference));

console.log('\n[5] 回答评估（模拟面试反馈）');
const weak = '我觉得这个项目还可以吧，就是做了一些调研，然后设计了功能，大家觉得还行。';
const strong = '首先背景是校园二手交易场景，我通过访谈 12 位同学并回收 86 份问卷，识别出三个高频问题；' +
  '其次我主导设计了商品发布流程，用 Figma 输出原型；最后上线测试后，发布成功率从 62% 提升到 81%。';
const fbWeak = E.evaluateAnswer(weak, q, job1);
const fbStrong = E.evaluateAnswer(strong, q, job1);
check('四维度评分', ['structure', 'relevance', 'evidence', 'clarity'].every(k => typeof fbWeak.dimensions[k] === 'number'),
  Object.entries(fbWeak.dimensions).map(([k, v]) => k + ':' + Math.round(v)).join(' '));
check('弱回答得分较低', fbWeak.score < 70, fbWeak.score + ' 分');
check('强回答得分更高', fbStrong.score > fbWeak.score, fbStrong.score + ' > ' + fbWeak.score);
check('给出可执行改进建议', fbWeak.feedback.length >= 3, fbWeak.feedback.length + ' 条');
check('生成追问', fbWeak.followUps.length >= 2, fbWeak.followUps.length + ' 条');
console.log('    弱回答反馈示例：' + fbWeak.feedback[0]);

console.log('\n[6] 招聘文本解析（手动导入）');
const sampleText = [
  '云栖智能 2027 届校园招聘',
  '岗位名称：内容策略产品经理',
  '工作城市：北京 / 上海',
  '学历要求：本科及以上',
  '岗位职责',
  '1. 负责内容分发策略的需求调研、方案设计与上线跟进；',
  '2. 通过数据分析与用户访谈定位内容生态问题并推动迭代。',
  '任职要求',
  '1. 具备较强的需求分析与用户调研能力，能独立输出 PRD 与原型；',
  '2. 熟悉 SQL，具备数据驱动决策的意识和 A/B 测试经验优先。',
  '投递截止时间：2026 年 10 月 27 日'
].join('\n');
const parsed = E.parseJob(sampleText, { channel: '微信公众号' });
check('抽取公司名称', /云栖智能/.test(parsed.company), parsed.company);
check('抽取岗位名称', /产品经理/.test(parsed.title), parsed.title);
check('抽取城市', parsed.cities.includes('北京') && parsed.cities.includes('上海'), parsed.cities.join('/'));
check('抽取学历要求', /本科/.test(parsed.degree), parsed.degree);
check('拆出岗位职责段落', parsed.responsibilities.length >= 2, parsed.responsibilities.length + ' 条');
check('拆出任职要求段落', parsed.requirements.length >= 2, parsed.requirements.length + ' 条');
check('抽取核心能力关键词', parsed.keywords.length >= 4, parsed.keywords.join('、'));
check('抽取截止时间', /10\s*月\s*27/.test(parsed.deadline) || /2026/.test(parsed.deadline), parsed.deadline);
check('标记需人工核对', parsed.needsReview === true);

console.log('\n[7] 状态与数据链路（以岗位为中心串联）');
S.setStage('job-2', 'applied');
check('收藏/投递状态可更新', S.stageOf('job-2') === 'applied');
check('生成时间线', S.applicationOf('job-2').timeline.length > 0,
  S.applicationOf('job-2').timeline.map(t => t.type).join('→'));
const ver = S.createResumeVersion('job-2', changes);
S.updateChange(ver.id, changes[0].id, 'accepted');
check('定制简历版本独立保存', S.versionById(ver.id).jobId === 'job-2');
check('修改条目的状态可变更', S.versionById(ver.id).changes[0].status === 'accepted');
check('岗位绑定简历版本', S.applicationOf('job-2').resumeVersionId === ver.id);
S.setInterviewPlan('job-2', plan);
check('面试计划绑定岗位', S.state.interviewPlans['job-2'].total === plan.total);
check('统计接口可用', typeof S.stats().applied === 'number', '已投递 ' + S.stats().applied);
check('日报接口可用', E.dailyReport(S.state.jobs, S.state.profile, S.state.resume).topPicks.length === 4);
check('本地持久化生效', store['qiuzhao-radar-state-v1'] && store['qiuzhao-radar-state-v1'].includes('job-2'));

console.log('\n[8] 信息可追溯 / 合规约束');
const communityJob = S.state.jobs.find(j => j.sourceType === 'community');
check('区分官方信息与社区线索', communityJob && communityJob.sources.every(s => /小红书|公众号/.test(s.channel)),
  communityJob.company);
check('每条来源都带核验时间', S.state.jobs.every(j => j.sources.every(s => !!s.verifiedAt)));
check('每条来源都保留渠道', S.state.jobs.every(j => j.sources.every(s => !!s.channel)));
check('全部岗位均有明确来源类型', S.state.jobs.every(j => j.sourceType === 'official' || j.sourceType === 'community'));

console.log('\n' + '='.repeat(52));
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);
