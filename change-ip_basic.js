const { exec } = require('child_process');
const https = require('https');
const http = require('http');
const path = require('path');

// 현재 디렉토리의 adb.exe 경로 설정
const ADB_PATH = path.join(__dirname, 'adb.exe');

/**
 * ipify와 IP-API를 사용하여 IP 주소를 확인하는 함수
 */
function checkIP() {
  return new Promise((resolve, reject) => {
    console.log('🔍 IP 주소 확인 중...');

    let results = {
      ipv4: {},
      ipv6: {}
    };
    let completed = 0;
    const totalChecks = 4; // IPv4와 IPv6 각각 2개 서비스

    // ipify IPv4 확인
    https.get('https://api.ipify.org', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (data.trim()) {
          results.ipv4.ipify = data.trim();
        }
        completed++;
        if (completed === totalChecks) resolve(results);
      });
    }).on('error', (err) => {
      console.error('ipify IPv4 확인 오류:', err);
      completed++;
      if (completed === totalChecks) resolve(results);
    });

    // ipify IPv6 확인
    https.get('https://api64.ipify.org', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (data.trim()) {
          results.ipv6.ipify = data.trim();
        }
        completed++;
        if (completed === totalChecks) resolve(results);
      });
    }).on('error', (err) => {
      console.error('ipify IPv6 확인 오류:', err);
      completed++;
      if (completed === totalChecks) resolve(results);
    });

    // IP-API IPv4 확인
    http.get('http://ip-api.com/json/?fields=query', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (jsonData.query) {
            results.ipv4['ip-api'] = jsonData.query;
          }
        } catch (e) {
          console.error('IP-API IPv4 응답 파싱 오류:', e);
        }
        completed++;
        if (completed === totalChecks) resolve(results);
      });
    }).on('error', (err) => {
      console.error('IP-API IPv4 확인 오류:', err);
      completed++;
      if (completed === totalChecks) resolve(results);
    });

    // IP-API IPv6 확인은 직접적인 엔드포인트가 없어서 curl 명령어 사용
    exec('curl -6 -s http://ip-api.com/json/?fields=query', (error, stdout, stderr) => {
      try {
        if (!error && stdout.trim()) {
          const jsonData = JSON.parse(stdout);
          if (jsonData.query) {
            results.ipv6['ip-api'] = jsonData.query;
          }
        }
      } catch (e) {
        console.error('IP-API IPv6 응답 파싱 오류:', e);
      }
      completed++;
      if (completed === totalChecks) resolve(results);
    });
  });
}

/**
 * IP 변경 함수 (기존 코드에서 checkIP() 함수만 교체)
 */
async function changeIP() {
  try {
    console.log('🚀 IP 변경 시작... 🚀');

    // 변경 전 IP 확인
    const oldIP = await checkIP();

    // IPv4, IPv6 결과 추출 (ipify 우선, 없으면 ip-api)
    // 네트워크 재연결 대기
    console.log('⏳ 네트워크 복구 대기 중...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // 추가 대기 시간
    console.log('⏳ 안정화를 위해 3초 더 대기 중...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 변경 후 IP 확인
    const newIP = await checkIP();

    // IPv4, IPv6 결과 추출 (ipify 우선, 없으면 ip-api)
    const newIPv4 = newIP.ipv4?.ipify || newIP.ipv4['ip-api'] || 'IP 확인 불가';
    const newIPv6 = newIP.ipv6?.ipify || newIP.ipv6['ip-api'] || 'IP 확인 불가';

    // console.log(`📍 변경된 IPv4: ${newIPv4}`);
    console.log(`📍 변경된 IP: ${newIPv6}`);
    console.log('✅ IP 확인 완료!');

    // IP 변경 여부 확인
    let changed = false;

    if (oldIPv4 !== newIPv4 && oldIPv4 !== 'IP 확인 불가' && newIPv4 !== 'IP 확인 불가') {
      // console.log(`🔄 IPv4 변경: ${oldIPv4} ➜ ${newIPv4}`);
      changed = true;
    }

    if (oldIPv6 !== newIPv6 && oldIPv6 !== 'IP 확인 불가' && newIPv6 !== 'IP 확인 불가') {
      console.log(`🔄 IPv6 변경: ${oldIPv6} ➜ ${newIPv6}`);
      changed = true;
    }

    if (changed) {
      console.log('🔄 IP가 성공적으로 변경되었습니다!');
    } else {
      console.log('⚠️ IP 변경이 확인되지 않았습니다.');
    }

  } catch (error) {
    // 오류 처리
    console.log('❌ 오류:', error);
  }
}

// 실행
changeIP();