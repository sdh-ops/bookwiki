import Link from "next/link";

export default function TermsPage() {
    return (
        <main className="min-h-screen bg-white">
            

            <article className="max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-8">북위키(Bookwiki) 이용약관</h1>

                <div className="prose prose-sm max-w-none text-gray-700 space-y-6">
                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-3">제1조 (목적)</h2>
                        <p>
                            본 약관은 북위키(이하 "커뮤니티")가 제공하는 모든 서비스의 이용 조건 및 절차, 이용자와 운영자의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-3">제2조 (용어의 정의)</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>"이용자"란 본 약관에 동의하고 커뮤니티 서비스를 이용하는 모든 회원을 말합니다.</li>
                            <li>"게시물"이란 이용자가 서비스 내에 게시한 글, 사진, 정보, 구인구직 공고 등을 말합니다.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-3">제3조 (이용자의 의무)</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>이용자는 관계 법령, 본 약관의 규정, 운영 지침 및 공지사항을 준수해야 합니다.</li>
                            <li>타인의 저작권을 침해하거나 출판계 내부의 비밀 유지 의무를 위반하는 정보를 게시해서는 안 됩니다.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-3">제4조 (운영진의 게시물 관리 권한 및 무통보 삭제)</h2>
                        <p className="mb-3">
                            운영진은 커뮤니티의 질서 유지와 정보의 정확성을 위해 아래 각 호에 해당하는 게시물을 사전 통보 없이 삭제, 이동 또는 이용 제한 조치를 취할 수 있습니다.
                        </p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>타인을 비방하거나 명예를 훼손하는 내용</li>
                            <li>공공질서 및 미풍양속에 위반되는 내용</li>
                            <li>확인되지 않은 허위 사실이나 유언비어 유포</li>
                            <li>영리 목적의 부적절한 광고 및 도배성 게시물</li>
                            <li>저작권 및 지식재산권을 침해하는 내용</li>
                            <li>구인구직 정보 중 필수 항목이 누락되거나 허위인 경우</li>
                            <li>게시판의 성격에 맞지 않는 게시물</li>
                            <li>기타 운영 정책상 부적절하다고 판단되는 경우</li>
                        </ul>
                        <p className="mt-3">
                            운영진은 제1항에 따른 무통보 삭제 조치에 대하여 이용자에게 별도의 설명 의무를 지지 않으며, 삭제로 인해 발생하는 게시물의 소실에 대해 책임지지 않습니다.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-3">제5조 (서비스 이용 제한)</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>제4조의 규정을 반복적으로 위반하거나 운영을 방해하는 이용자에 대해 운영진은 계정 정지, IP 차단 등의 조치를 취할 수 있습니다.</li>
                            <li>이용자는 운영진의 조치에 대해 이의를 제기할 수 없으며, 운영진의 판단이 우선합니다.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-3">제6조 (책임 제한 및 면책)</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>커뮤니티 내 게시된 정보(구인구직, 지원사업 등)의 정확성과 신뢰도에 대한 최종 판단은 이용자 본인에게 있으며, 이로 인해 발생하는 손해에 대해 운영진은 책임을 지지 않습니다.</li>
                            <li>이용자 간의 분쟁(정보 교환 중 발생한 갈등, 채용 계약 문제 등)에 운영진은 개입하지 않으며 어떠한 법적 책임도 지지 않습니다.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-3">제7조 (약관의 개정)</h2>
                        <p>
                            운영진은 필요한 경우 본 약관을 개정할 수 있으며, 개정된 약관은 공지사항을 통해 공지함으로써 효력이 발생합니다.
                        </p>
                    </section>

                    <div className="mt-10 pt-6 border-t border-gray-200 text-sm text-gray-500">
                        <p>시행일자: 2026년 3월 12일</p>
                    </div>
                </div>
            </article>

            <footer className="mt-10 border-t border-gray-200 bg-gray-50 py-10">
                <div className="max-w-4xl mx-auto px-4 text-center text-xs text-gray-400">
                    <p className="mb-2">© 2026 북위키 (Book-Wiki). All rights reserved.</p>
                    <p className="space-x-3">
                        <Link href="/" className="hover:underline">홈으로</Link>
                        <Link href="/privacy" className="hover:underline">개인정보처리방침</Link>
                    </p>
                </div>
            </footer>
        </main>
    );
}
