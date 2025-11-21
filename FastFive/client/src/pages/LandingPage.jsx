import React, { useState } from 'react';
import { Form, Input, Button, DatePicker, InputNumber, message, Modal } from 'antd';
import { EnvironmentOutlined, TeamOutlined, RocketOutlined, SafetyOutlined } from '@ant-design/icons';
import Header from '../components/Header';
import Footer from '../components/Footer';
import api from '../api/axiosConfig';
import './LandingPage.css';

const LandingPage = () => {
    const [form] = Form.useForm();
    const [isModalVisible, setIsModalVisible] = useState(false);

    const onFinish = async (values) => {
        try {
            const formattedValues = {
                ...values,
                move_in_date: values.move_in_date ? values.move_in_date.format('YYYY-MM-DD') : null,
            };

            await api.post('/inquiry', formattedValues);
            message.success('상담 신청이 완료되었습니다. 담당자가 곧 연락드리겠습니다.');
            form.resetFields();
            setIsModalVisible(false);
        } catch (error) {
            console.error('Submission failed:', error);
            message.error('신청 중 오류가 발생했습니다. 다시 시도해주세요.');
        }
    };

    const showModal = () => {
        setIsModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
    };

    return (
        <div className="landing-page">
            <Header />

            {/* Hero Section */}
            <section className="hero">
                <div className="hero-content">
                    <h1 className="hero-title">
                        국내 1위<br />
                        공유오피스 플랫폼
                    </h1>
                    <p className="hero-subtitle">
                        성공적인 비즈니스를 위한 최고의 공간, FASTFIVE
                    </p>
                    <div className="hero-buttons">
                        <button className="hero-btn primary" onClick={showModal}>
                            무료 상담 신청
                        </button>
                        <button className="hero-btn secondary">
                            오피스 둘러보기
                        </button>
                    </div>
                </div>
                <div className="hero-image">
                    <div className="hero-placeholder">
                        {/* Modern office illustration */}
                        <div className="office-icon">🏢</div>
                    </div>
                </div>
            </section>

            {/* Services Section */}
            <section className="services">
                <div className="container">
                    <h2 className="section-title">FASTFIVE가 제공하는 서비스</h2>
                    <div className="services-grid">
                        <div className="service-card">
                            <div className="service-icon">
                                <EnvironmentOutlined style={{ fontSize: '48px', color: 'var(--orange)' }} />
                            </div>
                            <h3>전국 70개 지점</h3>
                            <p>서울, 경기 주요 지역에 위치한 프리미엄 오피스 공간</p>
                        </div>

                        <div className="service-card">
                            <div className="service-icon">
                                <TeamOutlined style={{ fontSize: '48px', color: 'var(--orange)' }} />
                            </div>
                            <h3>맞춤형 솔루션</h3>
                            <p>1인부터 100인 이상까지, 규모에 맞는 최적의 공간</p>
                        </div>

                        <div className="service-card">
                            <div className="service-icon">
                                <RocketOutlined style={{ fontSize: '48px', color: 'var(--orange)' }} />
                            </div>
                            <h3>빠른 입주</h3>
                            <p>상담부터 입주까지 최소 3일, 즉시 업무 시작 가능</p>
                        </div>

                        <div className="service-card">
                            <div className="service-icon">
                                <SafetyOutlined style={{ fontSize: '48px', color: 'var(--orange)' }} />
                            </div>
                            <h3>프리미엄 시설</h3>
                            <p>최신 인테리어, 초고속 인터넷, 회의실 무료 이용</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <div className="container">
                    <div className="cta-content">
                        <h2>지금 바로 시작하세요</h2>
                        <p>FASTFIVE와 함께 성공적인 비즈니스를 경험해보세요</p>
                        <button className="cta-button" onClick={showModal}>
                            무료 상담 신청하기
                        </button>
                    </div>
                </div>
            </section>

            <Footer />

            {/* Consultation Form Modal */}
            <Modal
                title="입주 상담 신청"
                open={isModalVisible}
                onCancel={handleCancel}
                footer={null}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    size="large"
                >
                    <Form.Item
                        name="company_name"
                        label="업체명"
                        rules={[{ required: true, message: '업체명을 입력해주세요' }]}
                    >
                        <Input placeholder="예: 패스트파이브" />
                    </Form.Item>

                    <Form.Item
                        name="customer_name"
                        label="담당자명"
                        rules={[{ required: true, message: '담당자명을 입력해주세요' }]}
                    >
                        <Input placeholder="예: 홍길동" />
                    </Form.Item>

                    <Form.Item
                        name="phone_number"
                        label="연락처"
                        rules={[{ required: true, message: '연락처를 입력해주세요' }]}
                    >
                        <Input placeholder="예: 010-1234-5678" />
                    </Form.Item>

                    <Form.Item
                        name="preferred_area"
                        label="희망 지역"
                    >
                        <Input placeholder="예: 강남, 역삼, 성수 등" />
                    </Form.Item>

                    <div style={{ display: 'flex', gap: '20px' }}>
                        <Form.Item
                            name="headcount"
                            label="입주 인원"
                            style={{ flex: 1 }}
                        >
                            <InputNumber min={1} style={{ width: '100%' }} placeholder="명" />
                        </Form.Item>

                        <Form.Item
                            name="move_in_date"
                            label="입주 희망일"
                            style={{ flex: 1 }}
                        >
                            <DatePicker style={{ width: '100%' }} placeholder="날짜 선택" />
                        </Form.Item>
                    </div>

                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            block
                            size="large"
                            style={{
                                backgroundColor: 'var(--orange)',
                                borderColor: 'var(--orange)',
                                height: '50px',
                                fontSize: '18px',
                                fontWeight: '600'
                            }}
                        >
                            무료 상담 신청하기
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default LandingPage;

