const axios = require('axios');
const cheerio = require('cheerio');

async function testAladin2() {
  const url = 'https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=DailyBest&CID=0';
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
  const $ = cheerio.load(res.data);

  let c = 0;
  $('.ss_book_box').each((i, el) => {
    if (c >= 3) return;
    const titleArea = $(el).find('.ss_book_list li').first();
    const bo3Text = titleArea.find('.bo3').text().trim();
    const titleText = bo3Text || titleArea.text().trim();

    console.log(`[Rank ${i+1}] bo3Text: ${bo3Text}`);
    console.log(`[Rank ${i+1}] titleText: ${titleText}`);
    console.log("-------------------");
    c++;
  });
}

testAladin2();
