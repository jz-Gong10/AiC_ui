import alpine from './art/alpine.svg';
import dunes from './art/dunes.svg';
import coast from './art/coast.svg';
import river from './art/river.svg';
import city from './art/city.svg';

export const photos = [
  { src: alpine, title: '山间静谧', caption: 'Alpine silence', demo: { score: 92, categories: ['自然风光', '山岳湖泊'], reason: '山体与倒影呼应，冷色层次清晰；主体集中，画面稳定。' } },
  { src: dunes, title: '追光沙丘', caption: 'Chasing the light', demo: { score: 89, categories: ['自然风光', '沙漠光影'], reason: '沙丘曲线引导视线，暖色光影协调；远近层次有节奏。' } },
  { src: coast, title: '海岸日落', caption: 'A moment to keep', demo: { score: 94, categories: ['自然风光', '海岸日落'], reason: '前景岩壁增加纵深，落日与海面呼应；明暗过渡柔和。' } },
  { src: river, title: '河谷漫步', caption: 'Along the river', demo: { score: 90, categories: ['自然风光', '河流山谷'], reason: '河流形成自然引导线，绿色层次舒展；构图有延伸感。' } },
  { src: city, title: '城市蓝调', caption: 'City in blue', demo: { score: 88, categories: ['城市建筑', '夜景蓝调'], reason: '建筑轮廓与灯光形成对比，蓝调统一；主体辨识度高。' } },
];
