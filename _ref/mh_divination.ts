import { getBaguaByIndex, getHexagramName, Bagua } from './bagua';
import { solarToLunar, LunarDate } from './lunar';
import { analyzeWuxingRelation, getElementStrength, WuxingRelation, Element } from './wuxing';
import { getTotalStrokes, analyzeCharStructure } from './strokes';

export interface DivinationInput {
  mode: 'time' | 'number' | 'text';
  date?: Date; // 时间起卦模式
  numbers?: number[]; // 数字起卦模式（2个或3个数字）
  text?: string; // 文字起卦模式
}

export interface Hexagram {
  upper: Bagua;
  lower: Bagua;
  name: string;
  lines: number[]; // 6爻，1表示阳爻，0表示阴爻
}

export interface DivinationResult {
  // 输入信息
  lunarDate?: LunarDate;
  inputNumbers?: number[];
  inputText?: string;
  textStrokes?: { upper: number; lower: number; total: number };
  
  // 卦象
  originalHexagram: Hexagram; // 本卦
  mutualHexagram: Hexagram; // 互卦
  changedHexagram: Hexagram; // 变卦
  
  // 动爻
  movingLine: number; // 第几爻动（1-6）
  
  // 体用
  subjectBagua: Bagua; // 体卦
  objectBagua: Bagua; // 用卦
  
  // 五行分析
  wuxingRelation: WuxingRelation;
  subjectStrength?: string; // 体卦旺衰
  objectStrength?: string; // 用卦旺衰
}

/**
 * 将三个二进制数字转换为八卦索引
 */
function binaryToBaguaIndex(line1: number, line2: number, line3: number): number {
  const sum = line1 + line2 * 2 + line3 * 4;
  const map: Record<number, number> = {
    7: 1, // 111 -> 乾
    3: 2, // 011 -> 兑
    5: 3, // 101 -> 离
    1: 4, // 001 -> 震
    6: 5, // 110 -> 巽
    2: 6, // 010 -> 坎
    4: 7, // 100 -> 艮
    0: 8, // 000 -> 坤
  };
  return map[sum] || 1;
}

/**
 * 将八卦转换为六爻数组
 */
function baguaToLines(bagua: Bagua): number[] {
  return bagua.binary.split('').map(b => parseInt(b));
}

/**
 * 创建卦象对象
 */
function createHexagram(upper: Bagua, lower: Bagua): Hexagram {
  const upperLines = baguaToLines(upper);
  const lowerLines = baguaToLines(lower);
  
  return {
    upper,
    lower,
    name: getHexagramName(upper.name, lower.name),
    lines: [...lowerLines, ...upperLines], // 从下到上
  };
}

/**
 * 计算互卦
 */
function calculateMutualHexagram(originalLines: number[]): Hexagram {
  // 下互卦：取第2、3、4爻
  const lowerMutual = binaryToBaguaIndex(originalLines[1], originalLines[2], originalLines[3]);
  
  // 上互卦：取第3、4、5爻
  const upperMutual = binaryToBaguaIndex(originalLines[2], originalLines[3], originalLines[4]);
  
  const lower = getBaguaByIndex(lowerMutual);
  const upper = getBaguaByIndex(upperMutual);
  
  return createHexagram(upper, lower);
}

/**
 * 计算变卦
 */
function calculateChangedHexagram(originalLines: number[], movingLine: number): Hexagram {
  const changedLines = [...originalLines];
  changedLines[movingLine - 1] = changedLines[movingLine - 1] === 1 ? 0 : 1;
  
  // 下卦（1-3爻）
  const lowerIndex = binaryToBaguaIndex(changedLines[0], changedLines[1], changedLines[2]);
  
  // 上卦（4-6爻）
  const upperIndex = binaryToBaguaIndex(changedLines[3], changedLines[4], changedLines[5]);
  
  const lower = getBaguaByIndex(lowerIndex);
  const upper = getBaguaByIndex(upperIndex);
  
  return createHexagram(upper, lower);
}

/**
 * 时间起卦
 */
export function divinationByTime(date: Date = new Date()): DivinationResult {
  const lunar = solarToLunar(date);
  
  // 计算上卦
  const upperSum = lunar.yearBranch + lunar.monthNumber + lunar.dayNumber;
  const upperIndex = upperSum % 8 || 8;
  const upperBagua = getBaguaByIndex(upperIndex);
  
  // 计算下卦
  const lowerSum = upperSum + lunar.hourBranch;
  const lowerIndex = lowerSum % 8 || 8;
  const lowerBagua = getBaguaByIndex(lowerIndex);
  
  // 计算动爻
  const movingLine = lowerSum % 6 || 6;
  
  // 创建本卦
  const originalHexagram = createHexagram(upperBagua, lowerBagua);
  
  // 计算互卦
  const mutualHexagram = calculateMutualHexagram(originalHexagram.lines);
  
  // 计算变卦
  const changedHexagram = calculateChangedHexagram(originalHexagram.lines, movingLine);
  
  // 确定体用
  const isMovingInUpper = movingLine >= 4;
  const subjectBagua = isMovingInUpper ? lowerBagua : upperBagua;
  const objectBagua = isMovingInUpper ? upperBagua : lowerBagua;
  
  // 五行分析
  const wuxingRelation = analyzeWuxingRelation(
    subjectBagua.element as Element,
    objectBagua.element as Element
  );
  
  const subjectStrength = getElementStrength(
    subjectBagua.element as Element,
    lunar.hourBranch
  );
  
  const objectStrength = getElementStrength(
    objectBagua.element as Element,
    lunar.hourBranch
  );
  
  return {
    lunarDate: lunar,
    originalHexagram,
    mutualHexagram,
    changedHexagram,
    movingLine,
    subjectBagua,
    objectBagua,
    wuxingRelation,
    subjectStrength,
    objectStrength,
  };
}

/**
 * 数字起卦
 */
export function divinationByNumber(numbers: number[]): DivinationResult {
  if (numbers.length < 2 || numbers.length > 3) {
    throw new Error('数字起卦需要输入2个或3个数字');
  }
  
  // 计算上卦和下卦
  const upperIndex = numbers[0] % 8 || 8;
  const lowerIndex = numbers[1] % 8 || 8;
  
  const upperBagua = getBaguaByIndex(upperIndex);
  const lowerBagua = getBaguaByIndex(lowerIndex);
  
  // 计算动爻
  let movingLine: number;
  if (numbers.length === 3) {
    movingLine = numbers[2] % 6 || 6;
  } else {
    movingLine = (numbers[0] + numbers[1]) % 6 || 6;
  }
  
  // 创建本卦
  const originalHexagram = createHexagram(upperBagua, lowerBagua);
  
  // 计算互卦
  const mutualHexagram = calculateMutualHexagram(originalHexagram.lines);
  
  // 计算变卦
  const changedHexagram = calculateChangedHexagram(originalHexagram.lines, movingLine);
  
  // 确定体用
  const isMovingInUpper = movingLine >= 4;
  const subjectBagua = isMovingInUpper ? lowerBagua : upperBagua;
  const objectBagua = isMovingInUpper ? upperBagua : lowerBagua;
  
  // 五行分析
  const wuxingRelation = analyzeWuxingRelation(
    subjectBagua.element as Element,
    objectBagua.element as Element
  );
  
  return {
    inputNumbers: numbers,
    originalHexagram,
    mutualHexagram,
    changedHexagram,
    movingLine,
    subjectBagua,
    objectBagua,
    wuxingRelation,
  };
}

/**
 * 文字起卦（测字）
 * 根据汉字的笔画数起卦
 */
export function divinationByText(text: string): DivinationResult {
  // 过滤只保留中文字符
  const chineseChars = Array.from(text).filter(char => /[\u4e00-\u9fa5]/.test(char));
  const charCount = chineseChars.length;
  
  if (charCount === 0) {
    throw new Error('请输入至少一个汉字');
  }
  
  let upperStrokes: number;
  let lowerStrokes: number;
  
  if (charCount === 1) {
    // 单字：按结构分上下
    const structure = analyzeCharStructure(chineseChars[0]);
    if (structure) {
      upperStrokes = structure.upper;
      lowerStrokes = structure.lower;
    } else {
      // 无法分析结构，平分笔画
      const total = getTotalStrokes(chineseChars[0]);
      upperStrokes = Math.ceil(total / 2);
      lowerStrokes = total - upperStrokes;
    }
  } else {
    // 多字：平分两半
    const midPoint = Math.floor(charCount / 2);
    const firstHalf = chineseChars.slice(0, midPoint).join('');
    const secondHalf = chineseChars.slice(midPoint).join('');
    
    upperStrokes = getTotalStrokes(firstHalf);
    lowerStrokes = getTotalStrokes(secondHalf);
  }
  
  // 计算总笔画数和动爻
  const totalStrokes = getTotalStrokes(text);
  const movingLine = (totalStrokes % 6) || 6;
  
  // 计算上卦和下卦
  const upperBaguaIndex = (upperStrokes % 8) || 8;
  const lowerBaguaIndex = (lowerStrokes % 8) || 8;
  
  const upperBagua = getBaguaByIndex(upperBaguaIndex);
  const lowerBagua = getBaguaByIndex(lowerBaguaIndex);
  
  // 创建本卦
  const originalHexagram: Hexagram = {
    upper: upperBagua,
    lower: lowerBagua,
    name: getHexagramName(upperBagua, lowerBagua),
    lines: [
      ...lowerBagua.lines,
      ...upperBagua.lines,
    ],
  };
  
  // 计算变卦
  const changedLines = [...originalHexagram.lines];
  changedLines[movingLine - 1] = changedLines[movingLine - 1] === 1 ? 0 : 1;
  
  const changedLowerLines = changedLines.slice(0, 3);
  const changedUpperLines = changedLines.slice(3, 6);
  
  const changedLowerBagua = Object.values(getBaguaByIndex(1).constructor)
    .find((b: any) => 
      b.lines && 
      b.lines[0] === changedLowerLines[0] &&
      b.lines[1] === changedLowerLines[1] &&
      b.lines[2] === changedLowerLines[2]
    ) as Bagua || lowerBagua;
    
  const changedUpperBagua = Object.values(getBaguaByIndex(1).constructor)
    .find((b: any) => 
      b.lines && 
      b.lines[0] === changedUpperLines[0] &&
      b.lines[1] === changedUpperLines[1] &&
      b.lines[2] === changedUpperLines[2]
    ) as Bagua || upperBagua;
  
  const changedHexagram: Hexagram = {
    upper: changedUpperBagua,
    lower: changedLowerBagua,
    name: getHexagramName(changedUpperBagua, changedLowerBagua),
    lines: changedLines,
  };
  
  // 计算互卦
  const mutualLines = [
    originalHexagram.lines[1],
    originalHexagram.lines[2],
    originalHexagram.lines[3],
    originalHexagram.lines[2],
    originalHexagram.lines[3],
    originalHexagram.lines[4],
  ];
  
  const mutualLowerLines = mutualLines.slice(0, 3);
  const mutualUpperLines = mutualLines.slice(3, 6);
  
  const mutualLowerBagua = Object.values(getBaguaByIndex(1).constructor)
    .find((b: any) => 
      b.lines && 
      b.lines[0] === mutualLowerLines[0] &&
      b.lines[1] === mutualLowerLines[1] &&
      b.lines[2] === mutualLowerLines[2]
    ) as Bagua || lowerBagua;
    
  const mutualUpperBagua = Object.values(getBaguaByIndex(1).constructor)
    .find((b: any) => 
      b.lines && 
      b.lines[0] === mutualUpperLines[0] &&
      b.lines[1] === mutualUpperLines[1] &&
      b.lines[2] === mutualUpperLines[2]
    ) as Bagua || upperBagua;
  
  const mutualHexagram: Hexagram = {
    upper: mutualUpperBagua,
    lower: mutualLowerBagua,
    name: getHexagramName(mutualUpperBagua, mutualLowerBagua),
    lines: mutualLines,
  };
  
  // 确定体用
  const subjectBagua = movingLine <= 3 ? lowerBagua : upperBagua;
  const objectBagua = movingLine <= 3 ? upperBagua : lowerBagua;
  
  // 五行分析
  const wuxingRelation = analyzeWuxingRelation(
    subjectBagua.element,
    objectBagua.element
  );
  
  return {
    inputText: text,
    textStrokes: {
      upper: upperStrokes,
      lower: lowerStrokes,
      total: totalStrokes
    },
    originalHexagram,
    mutualHexagram,
    changedHexagram,
    movingLine,
    subjectBagua,
    objectBagua,
    wuxingRelation,
  };
}

/**
 * 统一的起卦接口
 */
export function performDivination(input: DivinationInput): DivinationResult {
  if (input.mode === 'time') {
    return divinationByTime(input.date);
  } else if (input.mode === 'number') {
    if (!input.numbers || input.numbers.length < 2) {
      throw new Error('数字起卦需要提供数字数组');
    }
    return divinationByNumber(input.numbers);
  } else if (input.mode === 'text') {
    if (!input.text || input.text.trim() === '') {
      throw new Error('文字起卦需要提供文字');
    }
    return divinationByText(input.text);
  }
  throw new Error('未知的起卦模式');
}
