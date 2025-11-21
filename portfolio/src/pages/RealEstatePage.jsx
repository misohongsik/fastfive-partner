import React from 'react';
import { Link } from 'react-router-dom';
import './RealEstatePage.css';

const RealEstatePage = () => {
    return (
        <div className="realestate-page">
            <header className="re-header">
                <div className="container">
                    <h1>Urban Living</h1>
                    <nav>
                        <a href="#properties">매물</a>
                        <a href="#services">서비스</a>
                        <Link to="/">←</Link>
                    </nav>
                </div>
            </header>

            <section className="re-hero">
                <div className="hero-content">
                    <h2>프리미엄 라이프를<br />경험하세요</h2>
                    <p>서울 강남 최고급 부동산 중개</p>
                    <button>매물 보기</button>
                </div>
            </section>

            <section id="properties" className="re-properties">
                <div className="container">
                    <h2>추천 매물</h2>
                    <div className="property-grid">
                        <div className="property-card">
                            <div className="property-img">🏢</div>
                            <h3>강남 오피스텔</h3>
                            <p>30평 | 신축 | 역세권</p>
                            <span className="price">9.8억</span>
                        </div>
                        <div className="property-card">
                            <div className="property-img">🏠</div>
                            <h3>서초 아파트</h3>
                            <p>45평 | 남향 | 학군</p>
                            <span className="price">15.2억</span>
                        </div>
                        <div className="property-card">
                            <div className="property-img">🏘️</div>
                            <h3>판교 빌라</h3>
                            <p>35평 | 신축 | 주차</p>
                            <span className="price">7.5억</span>
                        </div>
                    </div>
                </div>
            </section>

            <section id="services" className="re-services">
                <div className="container">
                    <h2>서비스</h2>
                    <div className="service-list">
                        <div className="service">✓ 매매/임대 중개</div>
                        <div className="service">✓ 인테리어 컨설팅</div>
                        <div className="service">✓ 법률 자문</div>
                        <div className="service">✓ 세무 상담</div>
                    </div>
                </div>
            </section>

            <footer className="re-footer">
                <p>© 2025 Urban Living. Premium Real Estate.</p>
            </footer>
        </div>
    );
};

export default RealEstatePage;
