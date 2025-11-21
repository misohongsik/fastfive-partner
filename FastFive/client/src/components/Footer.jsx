import React from 'react';
import './Footer.css';

const Footer = () => {
    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-content">
                    <div className="footer-section">
                        <h3 className="footer-logo">FASTFIVE</h3>
                        <p className="footer-description">
                            국내 1위 공유오피스 플랫폼
                        </p>
                    </div>

                    <div className="footer-section">
                        <h4>서비스</h4>
                        <ul>
                            <li><a href="#office">오피스</a></li>
                            <li><a href="#lounge">라운지</a></li>
                            <li><a href="#meeting">회의실</a></li>
                        </ul>
                    </div>

                    <div className="footer-section">
                        <h4>고객지원</h4>
                        <ul>
                            <li><a href="#faq">FAQ</a></li>
                            <li><a href="#contact">문의하기</a></li>
                            <li><a href="#guide">이용안내</a></li>
                        </ul>
                    </div>

                    <div className="footer-section">
                        <h4>회사</h4>
                        <ul>
                            <li><a href="#about">회사소개</a></li>
                            <li><a href="#recruit">채용</a></li>
                            <li><a href="#partnership">파트너십</a></li>
                        </ul>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p>&copy; 2025 FASTFIVE. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
