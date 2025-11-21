import React from 'react';
import { Link } from 'react-router-dom';
import './AcademyPage.css';

const AcademyPage = () => {
    return (
        <div className="academy-page">
            <header className="academy-header">
                <div className="container">
                    <h1>BrightMinds 🌟</h1>
                    <nav>
                        <a href="#curriculum">커리큘럼</a>
                        <a href="#teachers">강사진</a>
                        <Link to="/">←</Link>
                    </nav>
                </div>
            </header>

            <section className="academy-hero">
                <div className="hero-content">
                    <h2>아이들의 꿈을 키웁니다</h2>
                    <p>창의적 사고와 문제 해결 능력을 기르는 교육</p>
                    <button>수강 신청</button>
                </div>
            </section>

            <section id="curriculum" className="academy-curriculum">
                <div className="container">
                    <h2>커리큘럼</h2>
                    <div className="curriculum-grid">
                        <div className="curriculum-card">
                            <div className="emoji">📖</div>
                            <h3>초등 국어</h3>
                            <p>독서와 논술로 표현력 UP</p>
                        </div>
                        <div className="curriculum-card">
                            <div className="emoji">🧮</div>
                            <h3>수학 특강</h3>
                            <p>사고력 수학과 문제 해결</p>
                        </div>
                        <div className="curriculum-card">
                            <div className="emoji">🎨</div>
                            <h3>창의 미술</h3>
                            <p>상상력과 표현력 발달</p>
                        </div>
                        <div className="curriculum-card">
                            <div className="emoji">💻</div>
                            <h3>코딩 클래스</h3>
                            <p>논리적 사고력 향상</p>
                        </div>
                    </div>
                </div>
            </section>

            <section id="teachers" className="academy-teachers">
                <div className="container">
                    <h2>최고의 강사진</h2>
                    <div className="teacher-list">
                        <div className="teacher">👨‍🏫 김선생 - 국어 전문</div>
                        <div className="teacher">👩‍🏫 박선생 - 수학 전문</div>
                        <div className="teacher">👨‍🎨 이선생 - 미술 전문</div>
                    </div>
                </div>
            </section>

            <section className="academy-cta">
                <h2>지금 등록하고 첫 달 50% 할인!</h2>
                <button>무료 상담 신청</button>
            </section>

            <footer className="academy-footer">
                <p>© 2025 BrightMinds Academy</p>
            </footer>
        </div>
    );
};

export default AcademyPage;
