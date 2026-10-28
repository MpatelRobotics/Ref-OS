// Public sample assets only. Real event photos continue to use private signed URLs.
export const SAMPLE_ROBOT_PHOTOS = {
 blrs: {url:'/sample-robots/blrs.jpg',credit:'BLRS · Purdue SIGBots',source:'https://cs.purdue.edu/news/articles/2024/purdues-acm-sigbots-win-world-championship.html'},
 'whoop-2019-20': {url:'/sample-robots/whoop-2019-20.jpg',credit:'WHOOP · Aggie Robotics (2019–20)',source:'https://www.aggierobotics.com/'},
 'whoop-2022-23': {url:'/sample-robots/whoop-2022-23.jpg',credit:'WHOOP · Aggie Robotics (2022–23)',source:'https://www.aggierobotics.com/'},
 'whoop-2024-25': {url:'/sample-robots/whoop-2024-25.jpg',credit:'WHOOP · Aggie Robotics (2024–25)',source:'https://www.aggierobotics.com/'},
};
export function sampleRobotPhoto(path) {
 const match=String(path||'').match(/^[0-9a-f-]{36}\/team\/97[0-9]{3}[A-Z]\/(?:s-[0-9a-f-]{36}\/)?sample-robot-(blrs|whoop-2019-20|whoop-2022-23|whoop-2024-25)\.jpg$/i);
 return match ? SAMPLE_ROBOT_PHOTOS[match[1].toLowerCase()] || null : null;
}
