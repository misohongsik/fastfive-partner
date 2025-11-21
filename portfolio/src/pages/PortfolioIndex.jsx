import React from 'react';
import { Link } from 'react-router-dom';
import './PortfolioIndex.css';

const PortfolioIndex = () => {
    const portfolios = [
        {
            id: 1,
            title: 'Café Aurora',
            category: '카페/레스토랑',
            description: '감성적이고 따뜻한 브런치 카페',
            color: '#D4A574',
            path: '/cafe',
            icon: '🍰'
        },
        {
            id: 2,
            title: 'PowerFit Gym',
            category: '피트니스/헬스장',
            description: '역동적이고 강렬한 프리미엄 헬스장',
            color: '#E53935',
            path: '/gym',
            icon: '💪'
        },
        {
            id: 3,
            title: 'NexGen Solutions',
            category: 'IT 스타트업',
            description: '혁신적이고 미래지향적인 AI/SaaS 기업',
            color: '#7C4DFF',
            path: '/startup',
            icon: '💻'
        },
        {
            id: 4,
            title: 'Urban Living',
            category: '부동산/인테리어',
            description: '세련되고 고급스러운 부동산 중개',
            color: '#C9A050',
            path: '/realestate',
            icon: '🏡'
        },
        {
            id: 5,
            title: 'BrightMinds Academy',
            category: '교육/학원',
            description: '친근하고 밝은 교육 기관',
            color: '#FF9800',
            path: '/academy',
            icon: '📚'
        }
    ];

    return (
        <div className="portfolio-index">
            <header className="index-header">
                <h1>Web Portfolio Showcase</h1>
                <p>5가지 업종별 웹사이트 디자인</p>
            </header>

            <div className="portfolio-grid">
                {portfolios.map((portfolio) => (
                    <Link
                        key={portfolio.id}
                        to={portfolio.path}
                        className="portfolio-card"
                        style={{ '--card-color': portfolio.color }}
                    >
                        <div className="card-icon">{portfolio.icon}</div>
                        <div className="card-content">
                            <span className="card-category">{portfolio.category}</span>
                            <h2 className="card-title">{portfolio.title}</h2>
                            <p className="card-description">{portfolio.description}</p>
                        </div>
                        <div className="card-arrow">→</div>
                    </Link>
                ))}
            </div>

            <footer className="index-footer">
                <p>Made with React + Vite | © 2025</p>
            </footer>
        </div>
    );
};

export default PortfolioIndex;
