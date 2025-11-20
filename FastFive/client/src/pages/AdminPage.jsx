import React, { useEffect, useState } from 'react';
import { Table, Select, Tag, Typography, message, Layout } from 'antd';
import api from '../api/axiosConfig';

const { Header, Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

const AdminPage = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const response = await api.get('/admin/list');
            if (response.data.success) {
                setData(response.data.data);
            }
        } catch (error) {
            message.error('데이터를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleStatusChange = async (id, newStatus) => {
        try {
            await api.patch('/admin/status', { id, status: newStatus });
            message.success('상태가 변경되었습니다.');
            fetchData(); // Refresh data
        } catch (error) {
            message.error('상태 변경 실패');
        }
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 60,
        },
        {
            title: '상태',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status, record) => (
                <Select
                    defaultValue={status}
                    style={{ width: 100 }}
                    onChange={(value) => handleStatusChange(record.id, value)}
                    bordered={false}
                >
                    <Option value="신규">신규</Option>
                    <Option value="상담중">상담중</Option>
                    <Option value="투어예약">투어예약</Option>
                    <Option value="계약완료">계약완료</Option>
                    <Option value="취소">취소</Option>
                </Select>
            ),
        },
        {
            title: '업체명',
            dataIndex: 'company_name',
            key: 'company_name',
        },
        {
            title: '담당자',
            dataIndex: 'customer_name',
            key: 'customer_name',
        },
        {
            title: '연락처',
            dataIndex: 'phone_number',
            key: 'phone_number',
        },
        {
            title: '희망지역',
            dataIndex: 'preferred_area',
            key: 'preferred_area',
        },
        {
            title: '인원',
            dataIndex: 'headcount',
            key: 'headcount',
            render: (text) => text ? `${text}명` : '-',
        },
        {
            title: '입주희망일',
            dataIndex: 'move_in_date',
            key: 'move_in_date',
        },
        {
            title: '신청일시',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (text) => new Date(text).toLocaleString(),
        },
    ];

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Header style={{ display: 'flex', alignItems: 'center', backgroundColor: '#001529' }}>
                <Title level={3} style={{ color: 'white', margin: 0 }}>FastFive Admin</Title>
            </Header>
            <Content style={{ padding: '50px' }}>
                <div style={{ background: '#fff', padding: 24, borderRadius: 8, minHeight: 280 }}>
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Title level={4}>상담 신청 내역</Title>
                        <Tag color="blue">Total: {data.length}</Tag>
                    </div>
                    <Table
                        columns={columns}
                        dataSource={data}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 10 }}
                    />
                </div>
            </Content>
        </Layout>
    );
};

export default AdminPage;
