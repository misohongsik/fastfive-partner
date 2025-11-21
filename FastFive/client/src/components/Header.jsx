import React from 'react';
import './Header.css';

const Header = () => {
    return (
        <header className="header">
            <div className="header-container">
                <div className="header-logo">
                    <a href="/">
                        <span className="logo-text">FASTFIVE</span>
                    </a>
                </div>

                <nav className="header-nav">
                    <a href="#find-office" className="nav-link">오피스 찾기</a>
                    <a href="#lounge" className="nav-link">라운지</a>
                    <a href="#promotion" className="nav-link">프로모션</a>
                    <a href="#partner" className="nav-link">파트너십</a>
                    <a href="#about" className="nav-link">회사소개</a>
                </nav>

                <div className="header-actions">
                    <button className="btn-estimate">무료 견적</button>
                    <button className="btn-consult">상담 신청</button>
                </div>
            </div>
        </header>
    );
};

export default Header;
