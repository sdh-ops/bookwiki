const axios = require('axios');
const cheerio = require('cheerio');

async function testAladin() {
  const url = 'https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=DailyBest&CID=0';
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
  const $ = cheerio.load(res.data);

  let c = 0;
  $('.ss_book_box').each((i, el) => {
    if (c >= 3) return;
    const titleArea = $(el).find('.ss_book_list li').first();
    const titleText = titleArea.find('.bo3').text().trim() || titleArea.text().trim();
    const priceArea = $(el).find('.ss_p2').text().trim();
    let infoRow = $(el).find('.ss_book_list li').filter((idx, li) => $(li).text().includes('|')).first();
    let info = infoRow.text().trim();

    console.log(`[Rank ${i+1}] Title: ${titleText}`);
    console.log(`info: ${info}`);
    console.log(`priceArea: ${priceArea}`);
    console.log("-------------------");
    c++;
  });
}

testAladin();
