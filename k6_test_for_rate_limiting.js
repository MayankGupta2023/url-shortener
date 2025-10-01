import http from 'k6/http';
import { sleep } from 'k6';

export let options = {
    duration: '1m', // total test duration
    vus: 5,         // number of concurrent virtual users
};

export default function () {
    const url = 'http://localhost:3000/GQUFowo';

    // Hit the redirect URL
    http.get(url, { tags: { name: 'redirect' } });

    // Hit security analytics endpoint
    const analytics = http.get('http://localhost:3000/analytics/GQUFowo/security', { tags: { name: 'analytics' } });
    
    // Optional: log response for debugging
    // console.log(analytics.body);

    sleep(0.2); // small pause to avoid overwhelming CPU, adjust if needed
}
