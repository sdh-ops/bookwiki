import Link from "next/link";

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-white">
            

            <article className="max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-8">북위키 개인정보 처리방침</h1>

                <div className="prose prose-sm max-w-none text-gray-700 space-y-6">
                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-3">제1조 (개인정보의 처리 목적)</h2>
                        <p>
                            북위키는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
                        </p>
                        <p className="mt-2">
                            <strong>커뮤니티 회원 가입 및 관리:</strong> 회원 가입 의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 서비스 부정 이용 방지, 각종 고지·통지 등을 목적으로 개인정보를 처리합니다.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-3">제2조 (처리하는 개인정보의 항목)</h2>
                        <p>북위키는 회원가입 시 서비스 제공을 위한 최소한의 개인정보를 수집하고 있습니다.</p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li><strong>수집 항목:</strong> 이메일 주소</li>
                            <li><strong>수집 방법:</strong> 홈페이지 회원가입을 통한 직접 입력</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-3">제3조 (개인정보의 처리 및 보유 기간)</h2>
                        <p>
                            북위키는 법령에 따른 개인정보 보유·이용 기간 또는 이용자로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용 기간 내에서 개인정보를 처리·보유합니다.
                        </p>
                        <p className="mt-2">개인정보 보유 기간은 다음과 같습니다.</p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li><strong>회원 탈퇴 시까지:</strong> 커뮤니티 회원 가입 및 관리 목적으로 수집된 개인정보는 회원 탈퇴 시 즉시 파기합니다.</li>
                            <li>단, 관계 법령 위반에 따른 수사·조사 등이 진행 중인 경우에는 해당 수사·조사 종료 시까지 보유할 수 있습니다.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-3">제4조 (개인정보의 파기 절차 및 방법)</h2>
                        <p>
                            북위키는 개인정보 보유 기간의 경과, 처리 목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다.
                        </p>
                        <p className="mt-2">
                            전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제합니다.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-3">제5조 (이용자의 권리·의무 및 그 행사방법)</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>이용자는 언제든지 등록되어 있는 자신의 개인정보를 조회하거나 수정할 수 있으며 회원 탈퇴를 통해 개인정보 이용 동의를 철회할 수 있습니다.</li>
                            <li>이용자가 개인정보의 오류에 대한 정정을 요청한 경우 정정을 완료하기 전까지 해당 개인정보를 이용 또는 제공하지 않습니다.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-3">제6조 (개인정보의 안전성 확보 조치)</h2>
                        <p>
                            북위키는 이용자의 개인정보를 취급함에 있어 개인정보가 분실, 도난, 유출, 변조 또는 훼손되지 않도록 안전성 확보를 위하여 기술적·관리적 대책을 강구하고 있습니다.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-3">제7조 (개인정보 보호책임자)</h2>
                        <p>
                            북위키는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 이용자의 불만 처리 및 피해 구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
                        </p>
                        <ul className="list-none pl-0 space-y-1 mt-3 bg-gray-50 p-4 rounded">
                            <li><strong>성명:</strong> 운영자</li>
                            <li><strong>연락처:</strong> bookwiki.official@gmail.com</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-3">제8조 (개인정보 처리방침 변경)</h2>
                        <p>
                            본 개인정보 처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의 추가, 삭제 및 교정이 있는 경우에는 공지사항을 통하여 고지할 것입니다.
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
                        <Link href="/terms" className="hover:underline">이용약관</Link>
                    </p>
                </div>
            </footer>
        </main>
    );
}
