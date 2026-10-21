// 五行生克关系

export type Element = '金' | '木' | '水' | '火' | '土';

export interface WuxingRelation {
  relation: string; // 关系描述
  result: string; // 吉凶判断
  description: string; // 详细说明
}

/**
 * 五行生克关系判断
 * @param subject 体卦五行
 * @param object 用卦五行
 */
export function analyzeWuxingRelation(subject: Element, object: Element): WuxingRelation {
  // 体生用
  if (generates(subject, object)) {
    return {
      relation: '体生用',
      result: '泄气',
      description: '体卦生用卦，能量外泄，事情较为费力，需要付出较多。'
    };
  }
  
  // 体克用
  if (controls(subject, object)) {
    return {
      relation: '体克用',
      result: '得财',
      description: '体卦克用卦，主导力强，能够掌控事态，有所收获。'
    };
  }
  
  // 用生体
  if (generates(object, subject)) {
    return {
      relation: '用生体',
      result: '受生（吉）',
      description: '用卦生体卦，得到助力和支持，事情顺利，吉利。'
    };
  }
  
  // 用克体
  if (controls(object, subject)) {
    return {
      relation: '用克体',
      result: '受克（凶）',
      description: '用卦克体卦，受到压制和阻碍，事情不利，需谨慎。'
    };
  }
  
  // 体用比和
  return {
    relation: '体用比和',
    result: '平稳',
    description: '体卦与用卦五行相同，平稳相助，事情按部就班发展。'
  };
}

/**
 * 判断五行相生关系
 */
function generates(from: Element, to: Element): boolean {
  const generationMap: Record<Element, Element> = {
    '金': '水',
    '水': '木',
    '木': '火',
    '火': '土',
    '土': '金',
  };
  return generationMap[from] === to;
}

/**
 * 判断五行相克关系
 */
function controls(from: Element, to: Element): boolean {
  const controlMap: Record<Element, Element> = {
    '金': '木',
    '木': '土',
    '土': '水',
    '水': '火',
    '火': '金',
  };
  return controlMap[from] === to;
}

/**
 * 获取五行的旺衰状态（基于月份地支）
 */
export function getElementStrength(element: Element, monthBranch: number): string {
  // 简化版本：基于季节判断
  // 春(寅卯辰)木旺、夏(巳午未)火旺、秋(申酉戌)金旺、冬(亥子丑)水旺
  const season = Math.floor((monthBranch - 1) / 3);
  
  const strengthMap: Record<number, Record<Element, string>> = {
    0: { '木': '旺', '火': '相', '水': '休', '金': '囚', '土': '死' }, // 春
    1: { '火': '旺', '土': '相', '木': '休', '水': '囚', '金': '死' }, // 夏
    2: { '金': '旺', '水': '相', '土': '休', '火': '囚', '木': '死' }, // 秋
    3: { '水': '旺', '木': '相', '金': '休', '土': '囚', '火': '死' }, // 冬
  };
  
  return strengthMap[season]?.[element] || '平';
}
