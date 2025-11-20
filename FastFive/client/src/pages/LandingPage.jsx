import React from 'react';
import { Form, Input, Button, DatePicker, InputNumber, message, Card, Typography } from 'antd';
import api from '../api/axiosConfig';

const { Title, Paragraph } = Typography;

const LandingPage = () => {
    const [form] = Form.useForm();

    const onFinish = async (values) => {
        try {
            // Convert moment/dayjs date to string if needed, but AntD DatePicker returns object.
            // We'll format it to string.
            const formattedValues = {
                ...values,
                move_in_date: values.move_in_date ? values.move_in_date.format('YYYY-MM-DD') : null,
            };

            await api.post('/inquiry', formattedValues);
            message.success('상담 신청이 완료되었습니다. 담당자가 곧 연락드리겠습니다.');
            form.resetFields();
        } catch (error) {
            console.error('Submission failed:', error);
            message.error('신청 중 오류가 발생했습니다. 다시 시도해주세요.');
        }
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
            {/* Hero Section */}
            <div style={{
                backgroundColor: '#fa8c16',
                padding: '60px 20px',
                textAlign: 'center',
                color: 'white'
            }}>
                <Title level={1} style={{ color: 'white', marginBottom: 10 }}>FASTFIVE PARTNER</Title>
                <Paragraph style={{ color: 'white', fontSize: '18px' }}>
                    성공적인 비즈니스를 위한 최고의 오피스 솔루션, 패스트파이브와 함께하세요.
                </Paragraph>
            </div>

            {/* Form Section */}
            <div style={{ maxWidth: 800, margin: '-40px auto 40px', padding: '0 20px' }}>
                <Card title="입주 상담 신청" bordered={false} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
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
                            <Button type="primary" htmlType="submit" block size="large" style={{ backgroundColor: '#fa8c16', borderColor: '#fa8c16', height: '50px', fontSize: '18px' }}>
                                무료 상담 신청하기
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>
            </div>
        </div>
    );
};

export default LandingPage;
