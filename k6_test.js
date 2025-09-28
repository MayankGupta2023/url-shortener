import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// Load all short URLs from a file "short_urls.txt"
const urls = new SharedArray('short urls', function() {
    return open('short_urls.txt').split('\n').filter(u => u.trim() !== '');
});

export const options = {
    stages: [
        { duration: '1m', target: 100 },   // ramp-up to 100 virtual users
        { duration: '3m', target: 100 },   // stay at 100 users
        { duration: '1m', target: 0 },     // ramp-down
    ],
    thresholds: {
        http_req_failed: ['rate<0.01'], // <1% failed requests
        http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
    },
};

export default function () {
    // Pick a random URL from the list
    const url = urls[Math.floor(Math.random() * urls.length)];

    // GET request with redirects disabled
    const res = http.get(url, { redirects: 0 });

    // Check 302 and Location header
    check(res, {
        'status is 302': (r) => r.status === 302,
        'has Location header': (r) => r.headers['Location'] !== undefined,
    });

    sleep(0.1); // small wait to avoid overwhelming laptop
}
