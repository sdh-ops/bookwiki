import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * 7일간의 순위 변화 및 플랫폼별 성과를 포함한 전문 도서 리포트 생성
 */
export const generateBookReport = async (book, trendData, platforms) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // 브랜딩 색상
  const primaryColor = [53, 94, 59]; // #355E3B
  
  // 1. 헤더 (Branding)
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text('BOOKWIKI INSIGHT REPORT', 20, 20);
  doc.setFontSize(10);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, 20, 30);

  // 2. 도서 기본 정보
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.text(book.title, 20, 60);
  
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`저자: ${book.author} | 출판사: ${book.publisher}`, 20, 70);

  // 3. 성과 요약 (KPIs)
  doc.setDrawColor(230, 230, 230);
  doc.line(20, 80, pageWidth - 20, 80);
  
  const peakRank = Math.min(...trendData.flatMap(d => 
    Object.values(d).filter(v => typeof v === 'number')
  ));

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text('Performance Summary', 20, 95);
  
  doc.setFontSize(10);
  doc.text(`최고 순위: ${peakRank}위`, 30, 105);
  doc.text(`분석 플랫폼: ${platforms.map(p => p.name).join(', ')}`, 30, 110);

  // 4. 트렌드 차트 캡처 (차트 엘리먼트 ID 필요)
  const chartElement = document.getElementById('trend-chart-container');
  if (chartElement) {
    const canvas = await html2canvas(chartElement);
    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 20, 120, pageWidth - 40, 80);
  }

  // 5. 플랫폼별 현재 순위 테이블
  doc.text('Platform Status', 20, 210);
  let y = 220;
  platforms.forEach(p => {
    const latest = trendData[trendData.length - 1]?.[p.id] || '-';
    doc.text(`${p.name}: ${latest}위`, 30, y);
    y += 10;
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('© 2026 BOOKWIKI TREND ENGINE. ALL RIGHTS RESERVED.', pageWidth / 2, 285, { align: 'center' });

  doc.save(`BookReport_${book.title.substring(0, 10)}.pdf`);
};

/**
 * 출판사 성과 통합 분석 리포트 생성
 */
export const generatePublisherReport = async (publisherName, insights, snapshots) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const primaryColor = [53, 94, 59];

  // 헤더
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 50, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(26);
  doc.text('PUBLISHER INSIGHT', 20, 25);
  doc.setFontSize(14);
  doc.text(publisherName, 20, 38);

  // 실적 요약
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.text('Market Presence Overview', 20, 70);

  const totalBooks = insights.ourBooks.length;
  const avgRank = insights.ourBooks.length > 0 
    ? (insights.ourBooks.reduce((sum, b) => sum + b.rank, 0) / totalBooks).toFixed(1)
    : 'N/A';

  doc.setFontSize(12);
  doc.text(`베스트셀러 진입 도서: ${totalBooks}권`, 30, 85);
  doc.text(`평균 순위: ${avgRank}위`, 30, 95);

  // 성적 상위 도서 리스트
  doc.text('Top Performing Titles', 20, 120);
  let y = 135;
  insights.ourBooks.sort((a, b) => a.rank - b.rank).slice(0, 10).forEach(b => {
    doc.setFontSize(10);
    doc.text(`${b.rank}위 | ${b.bw_books.title}`, 30, y);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`플랫폼: ${b.platform}`, 30, y + 4);
    doc.setTextColor(0, 0, 0);
    y += 15;
  });

  // 시장 점유율 분석
  doc.setFontSize(14);
  doc.text('Competitor Market Share', 20, 240);
  let shareY = 255;
  insights.topPublishers.forEach(([pub, count]) => {
    doc.setFontSize(10);
    doc.text(`${pub}: ${count}권`, 30, shareY);
    shareY += 8;
  });

  doc.save(`PublisherReport_${publisherName}.pdf`);
};
