/* ------------------------------------------------------------------
 * data.js — 示例数据（全部为虚构 Demo 数据）
 * 说明：本项目为产品原型演示。所有公司、岗位、面经均为示例，
 * 不代表任何真实企业的招聘信息。真实部署时应接入官方招聘来源。
 * ---------------------------------------------------------------- */
(function (window) {
  'use strict';

  var META = {
    version: '1.0.0',
    productName: '秋招雷达',
    productSub: 'AI 求职工作台',
    dataNotice: '本产品当前使用示例数据，用于演示完整交互链路，并非实时招聘信息。',
    highMatchThreshold: 72,
    today: '2026-10-09'
  };

  /* 目标岗位方向字典：用于 JD 解析与匹配计算 */
  var SKILL_LEXICON = {
    产品: ['需求分析', '用户调研', '原型设计', 'PRD', 'Axure', 'Figma', '竞品分析', '数据驱动', 'A/B测试', '项目管理', '跨部门协作', '用户增长', '商业化', '指标体系', '流程图'],
    数据: ['SQL', 'Python', '数据分析', 'Excel', 'BI', 'Tableau', '指标体系', '数据看板', '用户分层', '归因分析', '实验设计'],
    运营: ['内容运营', '活动策划', '用户运营', '社群运营', '增长', '转化率', '文案', '投放', '新媒体'],
    设计: ['交互设计', '视觉设计', 'Figma', 'Sketch', '设计规范', '可用性测试'],
    技术: ['Java', 'Go', 'Python', '数据结构', '算法', '分布式', 'MySQL', 'Redis', 'Linux']
  };

  var SKILL_ALIAS = {
    '需求分析': ['需求调研', '需求梳理', '需求文档', '需求管理'],
    '用户调研': ['用户访谈', '用户研究', '深度访谈', '问卷'],
    '原型设计': ['原型', '线框图', '交互原型', '高保真原型'],
    '数据驱动': ['数据导向', '用数据说话', '数据决策', '数据分析能力'],
    'A/B测试': ['AB测试', 'ab test', '对照组实验', '实验平台'],
    '跨部门协作': ['跨团队协作', '多部门沟通', '协同推进'],
    '商业化': ['变现', '营收', '广告变现', '付费转化'],
    '指标体系': ['北极星指标', '指标拆解', '数据指标', '核心指标'],
    '用户增长': ['拉新', '留存', '促活', '增长策略', '用户增长策略'],
    '项目管理': ['项目推进', '排期管理', '项目跟进']
  };

  /* ---------------- 个人求职画像（首次使用引导生成的示例） ------------- */
  var DEFAULT_PROFILE = {
    name: '林知遥',
    avatarText: '林',
    school: '示例大学',
    degree: '硕士',
    major: '信息管理与信息系统',
    gradYear: '2027 届',
    cities: ['北京', '上海', '杭州'],
    directions: ['产品', '数据'],
    targetCompanies: ['星野科技', '云栖智能', '山脉网络', '北辰数据'],
    industry: ['互联网', '人工智能', '电商'],
    salaryExpect: '20-30K',
    priority: '产品经理 / 数据产品',
    onboarded: false
  };

  /* ---------------------------- 原始简历 ---------------------------- */
  var DEFAULT_RESUME = {
    id: 'resume-base',
    updatedAt: '2026-09-28',
    basics: {
      name: '林知遥',
      phone: '138****2043',
      email: 'linzhiyao@example.com',
      city: '北京',
      headline: '2027 届 · 信息管理与信息系统 · 目标岗位：产品经理'
    },
    education: [
      {
        id: 'edu-1',
        school: '示例大学',
        degree: '硕士 · 信息管理与信息系统',
        period: '2025.09 - 2027.06',
        detail: '核心课程：数据挖掘、信息系统分析、用户行为研究；GPA 3.7/4.0'
      },
      {
        id: 'edu-2',
        school: '示例理工大学',
        degree: '本科 · 电子商务',
        period: '2021.09 - 2025.06',
        detail: '校级奖学金两次；电子商务创新大赛省级二等奖'
      }
    ],
    internships: [
      {
        id: 'int-1',
        company: '拾光互娱',
        role: '产品运营实习生',
        period: '2026.03 - 2026.08',
        bullets: [
          '参与社区内容板块的日常运营，整理用户反馈并输出周报。',
          '协助策划一场站内活动，负责活动页面文案与客服话术。',
          '参与竞品功能调研，整理了一份竞品对比文档。'
        ]
      }
    ],
    projects: [
      {
        id: 'proj-1',
        name: '校园二手交易平台',
        role: '产品负责人（课程项目，4 人团队）',
        period: '2025.10 - 2026.01',
        bullets: [
          '参与校园二手交易平台项目，负责部分需求调研和功能设计。',
          '设计了商品发布和搜索页面的原型。',
          '项目获得了课程小组第一的成绩。'
        ]
      },
      {
        id: 'proj-2',
        name: '校园图书漂流数据分析',
        role: '数据分析（个人项目）',
        period: '2026.02 - 2026.04',
        bullets: [
          '收集了校内图书漂流点的借还数据，使用 Python 做清洗和统计。',
          '用 Tableau 制作了一个可视化看板。'
        ]
      }
    ],
    skills: ['Figma', 'Axure', 'SQL', 'Python 基础', 'Excel', 'Tableau', '用户调研', '原型设计'],
    awards: ['校级学业奖学金（2 次）', '电子商务创新大赛省级二等奖']
  };

  /* ---------------------------- 岗位库 ---------------------------- */
  function official(channel, url) {
    return { channel: channel || '企业招聘官网', url: url || 'https://example.com/careers', publishedAt: '2026-10-08', verifiedAt: '2026-10-09' };
  }
  function community(channel, url, verifiedAt) {
    return { channel: channel, url: url || 'https://example.com/post', publishedAt: '2026-10-07', verifiedAt: verifiedAt || '2026-10-08' };
  }

  var JOBS = [
    {
      id: 'job-1',
      company: '星野科技',
      logoText: '星',
      logoColor: '#4f7cff',
      industry: '互联网',
      title: '产品经理（校招）',
      direction: '产品',
      city: '北京',
      cities: ['北京', '上海'],
      degree: '本科及以上',
      batch: '2027 届校园招聘',
      salary: '20-30K · 15 薪',
      sourceType: 'official',
      status: 'open',
      deadline: '2026-10-20',
      sources: [official('企业招聘官网'), community('微信公众号 · 秋招启动通知', 'https://example.com/wechat', '2026-10-09')],
      summary: '负责社区内容方向的产品规划与需求落地，与设计、研发、运营紧密协作。',
      responsibilities: [
        '负责社区内容模块的需求调研、方案设计与上线跟进',
        '通过数据分析和用户访谈定位问题，推动产品迭代',
        '与运营、算法团队协作，提升内容分发效率与用户留存'
      ],
      requirements: [
        '本科及以上学历，2027 届毕业生',
        '具备较强的需求分析能力，能独立输出 PRD 与原型',
        '有用户调研经验，能够通过访谈和问卷验证需求',
        '数据敏感，熟悉 SQL 或至少一种数据分析工具',
        '有内容社区或社交产品的项目/实习经历优先'
      ],
      nice: ['熟悉 A/B 测试流程', '有完整的项目从 0 到 1 经历'],
      keywords: ['需求分析', '用户调研', '原型设计', 'PRD', '数据驱动', 'A/B测试', '内容社区', '留存']
    },
    {
      id: 'job-2',
      company: '云栖智能',
      logoText: '云',
      logoColor: '#6b5bff',
      industry: '人工智能',
      title: 'AI 产品经理（校招）',
      direction: '产品',
      city: '北京',
      cities: ['北京', '深圳'],
      degree: '硕士及以上',
      batch: '2027 届校园招聘',
      salary: '25-35K · 16 薪',
      sourceType: 'official',
      status: 'open',
      deadline: '2026-10-25',
      sources: [official('企业招聘官网')],
      summary: '面向大模型应用场景，负责对话式产品的需求设计与效果评估。',
      responsibilities: [
        '调研大模型在垂直场景的落地机会，输出产品方案',
        '设计对话式产品的交互流程与评测标准',
        '与算法团队协作优化模型输出质量'
      ],
      requirements: [
        '硕士及以上学历，计算机、信息管理相关专业优先',
        '对大模型或 AI 应用有实际使用和研究经验',
        '具备数据分析能力，能够定义并跟踪指标',
        '有 AI 相关项目经验者优先'
      ],
      nice: ['了解 Prompt Engineering', '有评测集设计经验'],
      keywords: ['需求分析', '指标体系', '数据驱动', 'AI应用', 'Prompt', '评测']
    },
    {
      id: 'job-3',
      company: '北辰数据',
      logoText: '北',
      logoColor: '#00a3a3',
      industry: '数据服务',
      title: '数据产品经理（校招）',
      direction: '数据',
      city: '上海',
      cities: ['上海', '杭州'],
      degree: '本科及以上',
      batch: '2027 届校园招聘',
      salary: '18-28K · 14 薪',
      sourceType: 'official',
      status: 'open',
      deadline: '2026-10-18',
      sources: [official('企业招聘官网'), official('校园招聘平台')],
      summary: '负责数据看板与分析工具的产品设计，支撑业务侧的数据决策。',
      responsibilities: [
        '梳理业务方的数据需求，设计指标体系与看板',
        '沉淀通用分析能力，提升数据使用效率',
        '跟踪功能上线后的使用情况并持续迭代'
      ],
      requirements: [
        '本科及以上学历，统计、信息管理相关专业优先',
        '熟悉 SQL，能够独立完成数据取数与验证',
        '有 BI 工具使用经验，理解指标口径定义',
        '逻辑清晰，能把模糊需求拆解为可执行方案'
      ],
      nice: ['有数据可视化项目经验', '了解埋点体系'],
      keywords: ['指标体系', 'SQL', 'BI', '数据看板', '需求分析', '归因分析']
    },
    {
      id: 'job-4',
      company: '山脉网络',
      logoText: '山',
      logoColor: '#f2743b',
      industry: '电商',
      title: '商业化产品经理（校招）',
      direction: '产品',
      city: '杭州',
      cities: ['杭州'],
      degree: '本科及以上',
      batch: '2027 届校园招聘',
      salary: '22-32K · 15 薪',
      sourceType: 'official',
      status: 'unknown',
      deadline: '2026-10-30',
      sources: [official('企业招聘官网')],
      summary: '负责广告与营销工具的产品设计，关注商家侧的投放效率。',
      responsibilities: [
        '调研商家投放诉求，设计广告产品功能',
        '设计投放效果的评估指标与实验方案',
        '与销售、运营团队协作推动产品渗透'
      ],
      requirements: [
        '本科及以上学历',
        '对商业化模式有基本理解，愿意深入研究广告业务',
        '具备数据驱动决策的能力，熟悉 A/B 测试优先',
        '较强的沟通与推动能力'
      ],
      nice: ['有电商或广告相关实习经历'],
      keywords: ['商业化', 'A/B测试', '数据驱动', '需求分析', '转化率']
    },
    {
      id: 'job-5',
      company: '蓝鲸出行',
      logoText: '蓝',
      logoColor: '#2f86ff',
      industry: '出行',
      title: '用户增长产品经理（校招）',
      direction: '产品',
      city: '北京',
      cities: ['北京'],
      degree: '本科及以上',
      batch: '2027 届校园招聘',
      salary: '20-30K · 15 薪',
      sourceType: 'community',
      status: 'unknown',
      deadline: '待官方确认',
      sources: [community('小红书 · 求职分享'), community('微信公众号 · 补录信息', 'https://example.com/wechat2')],
      summary: '负责拉新、留存方向的增长实验与产品优化。',
      responsibilities: [
        '设计并落地用户增长实验，分析实验结论',
        '优化新用户转化链路，提升关键节点转化率',
        '沉淀增长方法论并复用'
      ],
      requirements: [
        '本科及以上学历，专业不限',
        '对增长模型和漏斗分析有理解',
        '有数据分析基础，能用数据验证假设',
        '善于沟通，能推动跨团队协作'
      ],
      nice: ['有活动运营或增长实习经验'],
      keywords: ['用户增长', '转化率', 'A/B测试', '数据分析', '留存']
    },
    {
      id: 'job-6',
      company: '谷雨科技',
      logoText: '谷',
      logoColor: '#3fae6b',
      industry: '互联网',
      title: '产品运营（校招）',
      direction: '运营',
      city: '深圳',
      cities: ['深圳', '广州'],
      degree: '本科及以上',
      batch: '2027 届校园招聘',
      salary: '15-22K · 14 薪',
      sourceType: 'official',
      status: 'open',
      deadline: '2026-10-16',
      sources: [official('企业招聘官网')],
      summary: '负责内容与活动的运营策划，提升用户活跃与留存。',
      responsibilities: [
        '策划并执行站内活动，跟踪活动数据',
        '整理用户反馈，输出运营策略建议',
        '维护核心用户社群，提升用户粘性'
      ],
      requirements: [
        '本科及以上学历',
        '有内容运营或活动运营经验',
        '对数据敏感，能通过数据复盘活动效果',
        '文字表达能力强'
      ],
      nice: ['有新媒体运营经验'],
      keywords: ['内容运营', '活动策划', '转化率', '用户运营', '数据复盘']
    },
    {
      id: 'job-7',
      company: '千帆数据',
      logoText: '千',
      logoColor: '#8a5cf6',
      industry: '企业服务',
      title: '数据分析师（校招）',
      direction: '数据',
      city: '上海',
      cities: ['上海'],
      degree: '本科及以上',
      batch: '2027 届校园招聘',
      salary: '18-26K · 14 薪',
      sourceType: 'official',
      status: 'open',
      deadline: '2026-10-22',
      sources: [official('企业招聘官网')],
      summary: '支撑业务侧的数据分析与专题研究，输出可落地的结论。',
      responsibilities: [
        '完成业务侧的数据取数与口径对齐',
        '针对业务问题开展专题分析并输出结论',
        '搭建和维护核心指标看板'
      ],
      requirements: [
        '本科及以上学历，统计、数学、信息管理相关专业',
        '熟练使用 SQL，掌握 Python 或 R 至少一种',
        '有较强的逻辑分析能力与表达沟通能力'
      ],
      nice: ['有可视化项目作品'],
      keywords: ['SQL', 'Python', '数据分析', '数据看板', '指标体系', 'Tableau']
    },
    {
      id: 'job-8',
      company: '拾光互娱',
      logoText: '拾',
      logoColor: '#e0619b',
      industry: '内容社区',
      title: '内容策略产品经理（校招）',
      direction: '产品',
      city: '北京',
      cities: ['北京'],
      degree: '本科及以上',
      batch: '2027 届校园招聘',
      salary: '21-30K · 15 薪',
      sourceType: 'official',
      status: 'open',
      deadline: '2026-10-28',
      sources: [official('企业招聘官网'), community('小红书 · 面试分享', 'https://example.com/xhs', '2026-10-06')],
      summary: '负责内容生态策略设计，平衡创作者激励与内容质量。',
      responsibilities: [
        '设计内容分发与创作者激励策略',
        '分析内容生态数据，识别并解决生态问题',
        '与算法团队协作优化推荐策略的产品侧表达'
      ],
      requirements: [
        '本科及以上学历',
        '对内容社区有深入使用和理解',
        '具备较强的需求分析与数据能力',
        '能独立推进跨团队项目'
      ],
      nice: ['自己是内容社区创作者'],
      keywords: ['需求分析', '数据驱动', '内容社区', '指标体系', '用户调研']
    },
    {
      id: 'job-9',
      company: '松果智能',
      logoText: '松',
      logoColor: '#d98a1f',
      industry: '人工智能',
      title: 'B 端产品经理（校招）',
      direction: '产品',
      city: '北京',
      cities: ['北京', '上海'],
      degree: '硕士及以上',
      batch: '2027 届校园招聘',
      salary: '24-34K · 15 薪',
      sourceType: 'official',
      status: 'open',
      deadline: '2026-11-02',
      sources: [official('企业招聘官网')],
      summary: '面向企业客户设计 SaaS 产品，负责需求梳理与方案交付。',
      responsibilities: [
        '与客户沟通业务诉求，转化为产品需求',
        '输出 PRD 与原型，推动研发落地',
        '跟踪客户使用情况，推动产品迭代'
      ],
      requirements: [
        '硕士及以上学历',
        '具备较强的逻辑思维与文档能力',
        '有 B 端项目或实习经历优先',
        '沟通表达清晰，能承受一定项目压力'
      ],
      nice: ['了解企业信息化流程'],
      keywords: ['需求分析', 'PRD', '原型设计', '跨部门协作', 'SaaS']
    },
    {
      id: 'job-10',
      company: '木星传媒',
      logoText: '木',
      logoColor: '#5b6cff',
      industry: '广告营销',
      title: '广告产品经理（校招）',
      direction: '产品',
      city: '广州',
      cities: ['广州', '深圳'],
      degree: '本科及以上',
      batch: '2027 届校园招聘',
      salary: '18-28K · 14 薪',
      sourceType: 'community',
      status: 'unknown',
      deadline: '待官方确认',
      sources: [community('小红书 · 招聘线索')],
      summary: '负责广告投放平台的产品功能设计与优化。',
      responsibilities: [
        '梳理投放链路中的效率问题并推动优化',
        '设计投放工具的功能与效果指标',
        '配合运营完成新功能的推广'
      ],
      requirements: [
        '本科及以上学历',
        '对广告或商业化业务有兴趣',
        '具备基本的数据分析能力'
      ],
      nice: ['有广告投放实习经验'],
      keywords: ['商业化', '转化率', '数据分析', '需求分析', '投放']
    },
    {
      id: 'job-11',
      company: '白鹭科技',
      logoText: '鹭',
      logoColor: '#1f9d8f',
      industry: '在线教育',
      title: '产品经理（校招）',
      direction: '产品',
      city: '杭州',
      cities: ['杭州'],
      degree: '本科及以上',
      batch: '2027 届校园招聘',
      salary: '16-24K · 13 薪',
      sourceType: 'official',
      status: 'open',
      deadline: '2026-10-19',
      sources: [official('企业招聘官网')],
      summary: '负责学习工具类产品的需求设计与迭代。',
      responsibilities: [
        '调研学生用户的学习场景与痛点',
        '设计并跟进功能从需求到上线',
        '通过数据复盘功能效果'
      ],
      requirements: [
        '本科及以上学历',
        '有用户调研经验',
        '具备较强的执行力与沟通能力'
      ],
      nice: ['有教育相关项目经历'],
      keywords: ['需求分析', '用户调研', '原型设计', '数据驱动']
    },
    {
      id: 'job-12',
      company: '云栖智能',
      logoText: '云',
      logoColor: '#6b5bff',
      industry: '人工智能',
      title: '策略运营（校招）',
      direction: '运营',
      city: '深圳',
      cities: ['深圳'],
      degree: '本科及以上',
      batch: '2027 届校园招聘',
      salary: '17-25K · 15 薪',
      sourceType: 'official',
      status: 'closed',
      deadline: '已截止',
      sources: [official('企业招聘官网')],
      summary: '负责 AI 产品的内容与用户策略运营。',
      responsibilities: ['制定内容策略并落地执行', '分析用户行为数据优化策略'],
      requirements: ['本科及以上学历', '有策略或运营相关经验'],
      nice: [],
      keywords: ['内容运营', '用户运营', '数据分析']
    },
    {
      id: 'job-13',
      company: '长夏网络',
      logoText: '夏',
      logoColor: '#e0783b',
      industry: '游戏',
      title: '游戏产品运营（校招）',
      direction: '运营',
      city: '成都',
      cities: ['成都'],
      degree: '本科及以上',
      batch: '2027 届校园招聘',
      salary: '15-23K · 14 薪',
      sourceType: 'official',
      status: 'open',
      deadline: '2026-10-24',
      sources: [official('企业招聘官网'), official('校园招聘平台')],
      summary: '负责游戏社区运营与活动策划。',
      responsibilities: ['策划游戏内活动并跟进效果', '维护玩家社区并收集反馈'],
      requirements: ['本科及以上学历', '热爱游戏，了解玩家社区文化'],
      nice: ['有游戏社群运营经验'],
      keywords: ['活动策划', '用户运营', '内容运营']
    },
    {
      id: 'job-14',
      company: '星野科技',
      logoText: '星',
      logoColor: '#4f7cff',
      industry: '互联网',
      title: '数据产品经理（校招）',
      direction: '数据',
      city: '上海',
      cities: ['上海'],
      degree: '本科及以上',
      batch: '2027 届校园招聘',
      salary: '20-29K · 15 薪',
      sourceType: 'official',
      status: 'open',
      deadline: '2026-10-21',
      sources: [official('企业招聘官网')],
      summary: '负责内部数据平台与分析工具的产品迭代。',
      responsibilities: ['梳理业务数据需求，设计数据产品功能', '推动数据资产沉淀与复用'],
      requirements: ['本科及以上学历', '熟悉 SQL 与指标体系设计', '有数据产品相关项目经验优先'],
      nice: ['了解埋点与数据治理'],
      keywords: ['SQL', '指标体系', '数据看板', '需求分析', '数据治理']
    },
    {
      id: 'job-15',
      company: '万维云',
      logoText: '万',
      logoColor: '#4a6cf7',
      industry: '企业服务',
      title: '增长产品经理（校招）',
      direction: '产品',
      city: '深圳',
      cities: ['深圳', '北京'],
      degree: '本科及以上',
      batch: '2027 届校园招聘',
      salary: '21-31K · 15 薪',
      sourceType: 'community',
      status: 'unknown',
      deadline: '待官方确认',
      sources: [community('微信公众号 · 秋招汇总')],
      summary: '负责 SaaS 产品的用户增长与转化优化。',
      responsibilities: ['优化注册与试用转化链路', '设计增长实验并验证'],
      requirements: ['本科及以上学历', '有增长或数据分析经验'],
      nice: [],
      keywords: ['用户增长', '转化率', 'A/B测试', '数据分析']
    },
    {
      id: 'job-16',
      company: '澄海科技',
      logoText: '澄',
      logoColor: '#2aa198',
      industry: '互联网',
      title: '交互设计师（校招）',
      direction: '设计',
      city: '北京',
      cities: ['北京'],
      degree: '本科及以上',
      batch: '2027 届校园招聘',
      salary: '18-26K · 14 薪',
      sourceType: 'official',
      status: 'open',
      deadline: '2026-10-27',
      sources: [official('企业招聘官网')],
      summary: '负责移动端产品的交互设计与可用性验证。',
      responsibilities: ['输出交互方案与高保真原型', '组织可用性测试并推动优化'],
      requirements: ['本科及以上学历', '熟练使用 Figma', '有完整的交互设计作品集'],
      nice: [],
      keywords: ['原型设计', '交互设计', '可用性测试', 'Figma']
    }
  ];

  /* ---------------------- 公开面经（示例） ---------------------- */
  var INTERVIEW_REPORTS = [
    {
      id: 'rpt-1',
      jobId: 'job-1',
      company: '星野科技',
      role: '产品经理（校招）',
      stage: '一面',
      source: '小红书 · 求职分享',
      url: 'https://example.com/xhs/report1',
      publishedAt: '2026-09-27',
      reliability: '社区用户分享，仅供参考',
      questions: ['请做一下自我介绍', '介绍一个你最有成就感的项目', '你是如何做需求优先级的？', '如果留存下降，你会怎么排查？']
    },
    {
      id: 'rpt-2',
      jobId: 'job-1',
      company: '星野科技',
      role: '产品经理（校招）',
      stage: '二面',
      source: '微信公众号 · 面经整理',
      url: 'https://example.com/wechat/report2',
      publishedAt: '2026-08-15',
      reliability: '社区整理内容，时效性未知',
      questions: ['你怎么理解这个岗位的工作内容？', '分析一款你常用的社区产品', '讲一个你和他人产生分歧并解决的例子']
    },
    {
      id: 'rpt-3',
      jobId: 'job-3',
      company: '北辰数据',
      role: '数据产品经理',
      stage: '一面',
      source: '应届生论坛 · 面经',
      url: 'https://example.com/bbs/report3',
      publishedAt: '2026-09-12',
      reliability: '社区用户分享，岗位年份可能不一致',
      questions: ['SQL 中如何做留存率计算？', '介绍一下你理解的指标体系', '如果业务方口径不一致你会怎么处理？']
    }
  ];

  /* ---------------------- 面试问题分类模板 ---------------------- */
  var QUESTION_BLUEPRINT = [
    {
      category: '自我介绍',
      items: [
        { q: '请用 2 分钟做一个自我介绍。', type: 'common' },
        { q: '为什么选择产品经理这个方向？', type: 'common' }
      ]
    },
    {
      category: '项目深挖',
      items: [
        { q: '介绍一个你最有成就感的项目，你具体负责什么？', type: 'common' },
        { q: '你是如何发现并验证用户需求的？', type: 'common' },
        { q: '你如何确定功能的优先级？依据是什么？', type: 'common' },
        { q: '这个项目最终的效果如何？有可验证的数据吗？', type: 'common' }
      ]
    },
    {
      category: '产品分析',
      items: [
        { q: '挑选一款你常用的产品，分析它的核心价值与改进空间。', type: 'common' },
        { q: '如何为 {{direction}} 方向设计一个新的功能？', type: 'predicted' }
      ]
    },
    {
      category: '数据分析',
      items: [
        { q: '如果核心指标突然下降 10%，你会如何排查？', type: 'common' },
        { q: '举一个你用数据做决策的例子。', type: 'common' }
      ]
    },
    {
      category: '业务理解',
      items: [
        { q: '你怎么理解 {{company}} 所在的行业和商业模式？', type: 'predicted' },
        { q: '你认为 {{title}} 这个岗位最重要的三项能力是什么？', type: 'predicted' }
      ]
    },
    {
      category: '行为面试',
      items: [
        { q: '讲一个你与他人意见不一致并最终推进解决的经历。', type: 'common' },
        { q: '讲一次你失败或没有达到预期的经历，你学到了什么？', type: 'common' },
        { q: '你如何安排多任务并行时的优先级？', type: 'common' }
      ]
    }
  ];

  /* ---------------------- 作品集与产品说明文案 ---------------------- */
  var ACCEPTANCE = [
    { ability: '招聘信息整理', ai: '提取岗位名称、要求、来源和时间', standard: '能将导入的招聘文本转为结构化岗位卡片', impl: '规则解析 + 关键词词典抽取字段' },
    { ability: '岗位匹配', ai: '对比个人画像与 JD', standard: '输出有依据的匹配分析和能力差距', impl: '技能交集 + 经历命中 + 差距反向检索' },
    { ability: '简历定制', ai: '重组真实经历，匹配岗位关键词', standard: '可预览、修改、保存和导出', impl: '逐条改写建议 + 人工接受/撤销闭环' },
    { ability: '面试准备', ai: '综合 JD、公开面经和个人经历', standard: '能生成分类问题、参考回答和追问', impl: '面经库 + STAR 模板 + 经历检索' },
    { ability: '求职管理', ai: '根据用户操作更新状态', standard: '状态变化后看板同步更新', impl: '统一状态机 + 本地持久化' }
  ];

  var PRINCIPLES = [
    { icon: '溯源', title: '信息可追溯', desc: '每条招聘信息和面经都保留来源渠道、原始链接与最近核验时间，区分官方信息与社区线索。' },
    { icon: '核验', title: '内容可核验', desc: 'AI 生成的简历不编造用户经历，面试预测题明确标注为「预测」，不伪装成企业真实题库。' },
    { icon: '可控', title: '用户可控', desc: '简历与投递内容由用户最终确认，AI 不会未经授权自动投递或公开个人信息。' }
  ];

  window.AIData = {
    META: META,
    SKILL_LEXICON: SKILL_LEXICON,
    SKILL_ALIAS: SKILL_ALIAS,
    DEFAULT_PROFILE: DEFAULT_PROFILE,
    DEFAULT_RESUME: DEFAULT_RESUME,
    JOBS: JOBS,
    INTERVIEW_REPORTS: INTERVIEW_REPORTS,
    QUESTION_BLUEPRINT: QUESTION_BLUEPRINT,
    ACCEPTANCE: ACCEPTANCE,
    PRINCIPLES: PRINCIPLES
  };
})(window);
