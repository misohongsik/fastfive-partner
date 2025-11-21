import React from 'react';
import { Link } from 'react-router-dom';
import './CafePage.css';

const CafePage = () => {
    return (
        <div className="bb-clone">
            {/* Header - Exact Blue Bottle Style */}
            <header className="bb-header-exact">
                <div className="bb-container-header">
                    <h1 className="bb-logo-text">CAFÉ AURORA</h1>
                    <nav className="bb-nav-exact">
                        <a href="#shop">SHOP</a>
                        <a href="#bestsellers">BEST SELLERS</a>
                        <a href="#subscriptions">SUBSCRIPTIONS</a>
                        <a href="#locations">LOCATIONS</a>
                        <a href="#about">ABOUT</a>
                        <a href="#learn">LEARN</a>
                    </nav>
                    <div className="bb-icons">
                        <button className="bb-icon-btn">🔍</button>
                        <button className="bb-icon-btn">👤</button>
                        <button className="bb-icon-btn">🛒</button>
                    </div>
                </div>
            </header>

            {/* Hero Section - The Holiday Collection */}
            <section className="bb-hero-exact">
                <div className="bb-hero-bg">
                    <div className="bb-hero-content-exact">
                        <h2>The Special Collection</h2>
                        <p>Gifts for every coffee lover on your list</p>
                        <button className="bb-hero-btn">Shop Gifts</button>
                    </div>
                </div>
            </section>

            {/* Shop By Collection - 4 Cards */}
            <section className="bb-collection-grid">
                <div className="bb-container-wide">
                    <h3 className="bb-section-heading">Shop By Collection</h3>

                    <div className="bb-four-grid">
                        <div className="bb-collection-card">
                            <div className="bb-card-image">
                                <div className="bb-placeholder">☕</div>
                            </div>
                            <h4>New and Limited</h4>
                            <p>Rare items that make perfect gifts</p>
                        </div>

                        <div className="bb-collection-card">
                            <div className="bb-card-image">
                                <div className="bb-placeholder">🎁</div>
                            </div>
                            <h4>Holiday Gift Sets</h4>
                            <p>Expertly curated and ready to gift</p>
                        </div>

                        <div className="bb-collection-card">
                            <div className="bb-card-image">
                                <div className="bb-placeholder">🥤</div>
                            </div>
                            <h4>Shop Drinkware</h4>
                            <p>For the coffee-lover you love</p>
                        </div>

                        <div className="bb-collection-card">
                            <div className="bb-card-image">
                                <div className="bb-placeholder">💝</div>
                            </div>
                            <h4>Gifts Under ₩30,000</h4>
                            <p>Small luxuries big on meaning</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Featured Section 1 - Full Width Image with Text */}
            <section className="bb-featured-full">
                <div className="bb-featured-bg">
                    <div className="bb-featured-overlay">
                        <h3>A Gift That Keeps on Giving</h3>
                        <p>Give the gift of freshly roasted coffee, delivered.</p>
                        <button className="bb-featured-btn">Gift a Subscription</button>
                    </div>
                </div>
            </section>

            {/* Featured Section 2 - Image Left, Text Right */}
            <section className="bb-featured-split">
                <div className="bb-container-wide">
                    <div className="bb-split-layout">
                        <div className="bb-split-image-box">
                            <div className="bb-placeholder-large">🔧</div>
                        </div>
                        <div className="bb-split-text-box">
                            <h3>Brew Great Coffee at Home</h3>
                            <p>From pour over to French press, find everything you need to brew delicious coffee.</p>
                            <a href="#brewing" className="bb-text-link">Shop Brewing Gear →</a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Featured Section 3 - Text Left, Image Right */}
            <section className="bb-featured-split bb-reverse">
                <div className="bb-container-wide">
                    <div className="bb-split-layout">
                        <div className="bb-split-text-box">
                            <h3>Find Us in Your Neighborhood</h3>
                            <p>Visit one of our cafes for a perfectly crafted coffee experience.</p>
                            <a href="#locations" className="bb-text-link">Find a Cafe →</a>
                        </div>
                        <div className="bb-split-image-box">
                            <div className="bb-placeholder-large">📍</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Newsletter Signup */}
            <section className="bb-newsletter">
                <div className="bb-container-narrow">
                    <h3>Stay Connected</h3>
                    <p>Get updates about new arrivals, special offers, and more.</p>
                    <form className="bb-newsletter-form">
                        <input type="email" placeholder="Email Address" />
                        <button type="submit">Subscribe</button>
                    </form>
                </div>
            </section>

            {/* Footer - Exact Blue Bottle Style */}
            <footer className="bb-footer-exact">
                <div className="bb-container-wide">
                    <div className="bb-footer-grid">
                        <div className="bb-footer-col">
                            <h5>About Us</h5>
                            <a href="#story">Our Story</a>
                            <a href="#cafes">Our Cafes</a>
                            <a href="#careers">Careers</a>
                            <a href="#press">Press</a>
                        </div>

                        <div className="bb-footer-col">
                            <h5>Customer Service</h5>
                            <a href="#contact">Contact Us</a>
                            <a href="#faq">FAQ</a>
                            <a href="#shipping">Shipping</a>
                            <a href="#returns">Returns</a>
                        </div>

                        <div className="bb-footer-col">
                            <h5>Resources</h5>
                            <a href="#brew">Brew Guides</a>
                            <a href="#blog">Blog</a>
                            <a href="#wholesale">Wholesale</a>
                        </div>

                        <div className="bb-footer-col">
                            <h5>Connect</h5>
                            <a href="#instagram">Instagram</a>
                            <a href="#facebook">Facebook</a>
                            <a href="#twitter">Twitter</a>
                            <a href="#email">Email Signup</a>
                        </div>
                    </div>

                    <div className="bb-footer-bottom">
                        <p>© 2025 Café Aurora, Inc.</p>
                        <div className="bb-footer-links">
                            <a href="#privacy">Privacy</a>
                            <a href="#terms">Terms</a>
                            <a href="#accessibility">Accessibility</a>
                            <Link to="/">Back to Portfolio</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default CafePage;
