import React from 'react';
import { Link } from 'react-router-dom';
import './GymPage.css';

const GymPage = () => {
    return (
        <div className="gym-page">
            {/* Header */}
            <header className="gym-header">
                <div className="container">
                    <h1 className="logo">POWERFIT</h1>
                    <nav>
                        <a href="#programs">프로그램</a>
                        <a href="#pricing">가격</a>
                        <a href="#trainers">트레이너</a>
                        <Link to="/" className="back-btn">←</Link>
                    </nav>
                </div>
            </header>

            {/* Hero */}
            <section className="gym-hero">
                <div className="hero-overlay">
                    <h2>당신의 한계를<br />돌파하세요</h2>
                    <p>최고의 시설과 전문 트레이너가 함께합니다</p>
                    <button className="hero-cta">무료 체험 신청</button>
                </div>
            </section>

            {/* Programs */}
            <section id="programs" className="gym-programs">
                <div className="container">
                    <h2 className="section-title">프로그램</h2>
                    <div className="programs-grid">
                        <div className="program-card">
                            <div className="program-icon">🏋️</div>
                            <h3>웨이트 트레이닝</h3>
                            <p>최신 장비로 근력 향상</p>
                        </div>
                        <div className="program-card">
                            <div className="program-icon">🥊</div>
                            <h3>복싱 클래스</h3>
                            <p>스트레스 해소와 체력 단련</p>
                        </div>
                        <div className="program-card">
                            <div className="program-icon">🧘</div>
                            <h3>요가 & 필라테스</h3>
                            <p>유연성과 코어 강화</p>
                        </div>
                        <div className="program-card">
                            <div className="program-icon">🏃</div>
                            <h3>크로스핏</h3>
                            <p>고강도 인터벌 트레이닝</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="gym-pricing">
                <div className="container">
                    <h2 className="section-title">회원권</h2>
                    <div className="pricing-cards">
                        <div className="price-card">
                            <h3>BASIC</h3>
                            <div className="price">₩99,000<span>/월</span></div>
                            <ul>
                                <li>✓ 모든 시설 이용</li>
                                <li>✓ 락커 제공</li>
                                <li>✓ 그룹 수업</li>
                            </ul>
                            <button className="price-btn">선택하기</button>
                        </div>
                        <div className="price-card featured">
                            <div className="badge">인기</div>
                            <h3>PRO</h3>
                            <div className="price">₩199,000<span>/월</span></div>
                            <ul>
                                <li>✓ BASIC 모든 혜택</li>
                                <li>✓ PT 4회</li>
                                <li>✓ 개인 락커</li>
                                <li>✓ 수건 제공</li>
                            </ul>
                            <button className="price-btn">선택하기</button>
                        </div>
                        <div className="price-card">
                            <h3>ELITE</h3>
                            <div className="price">₩299,000<span>/월</span></div>
                            <ul>
                                <li>✓ PRO 모든 혜택</li>
                                <li>✓ PT 8회</li>
                                <li>✓ 영양 상담</li>
                                <li>✓ 사우나 & 스파</li>
                            </ul>
                            <button className="price-btn">선택하기</button>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="gym-cta">
                <div className="container">
                    <h2>오늘부터 시작하세요</h2>
                    <p>첫 달 50% 할인 + 무료 체험 1회</p>
                    <button className="cta-button">지금 등록하기</button>
                </div>
            </section>

            {/* Footer */}
            <footer className="gym-footer">
                <p>© 2025 PowerFit Gym. Transform Your Life.</p>
            </footer>
        </div>
    );
};

export default GymPage;
