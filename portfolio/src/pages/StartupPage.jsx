import React from 'react';
import { Link } from 'react-router-dom';
import './StartupPage.css';

const StartupPage = () => {
    return (
        <div className="startup-page">
            <header className="startup-header">
                <div className="container">
                    <h1>NexGen</h1>
                    <nav>
                        <a href="#features">Features</a>
                        <a href="#tech">Technology</a>
                        <Link to="/">←</Link>
                    </nav>
                </div>
            </header>

            <section className="startup-hero">
                <div className="container">
                    <h2>AI-Powered<br />Future Solutions</h2>
                    <p>차세대 인공지능 기술로 비즈니스를 혁신합니다</p>
                    <button>Get Started</button>
                </div>
            </section>

            <section id="features" className="startup-features">
                <div className="container">
                    <h2>Features</h2>
                    <div className="feature-grid">
                        <div className="feature-item">
                            <div className="icon">🤖</div>
                            <h3>AI Analytics</h3>
                            <p>머신러닝 기반 데이터 분석</p>
                        </div>
                        <div className="feature-item">
                            <div className="icon">⚡</div>
                            <h3>Real-time Processing</h3>
                            <p>실시간 데이터 처리 및 예측</p>
                        </div>
                        <div className="feature-item">
                            <div className="icon">🔒</div>
                            <h3>Secure Cloud</h3>
                            <p>군사급 보안 클라우드 시스템</p>
                        </div>
                        <div className="feature-item">
                            <div className="icon">📊</div>
                            <h3>Dashboard</h3>
                            <p>직관적인 데이터 시각화</p>
                        </div>
                    </div>
                </div>
            </section>

            <section id="tech" className="startup-tech">
                <div className="container">
                    <h2>Technology Stack</h2>
                    <div className="tech-list">
                        <span>Python</span>
                        <span>TensorFlow</span>
                        <span>React</span>
                        <span>Node.js</span>
                        <span>MongoDB</span>
                        <span>AWS</span>
                    </div>
                </div>
            </section>

            <section className="startup-cta">
                <h2>지금 시작하세요</h2>
                <button>Free Trial</button>
            </section>

            <footer className="startup-footer">
                <p>© 2025 NexGen Solutions</p>
            </footer>
        </div>
    );
};

export default StartupPage;
