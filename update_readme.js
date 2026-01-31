const https = require('https');
const fs = require('fs');

const USERNAME = 'st-mn';

function getRepos() {
    return new Promise(async (resolve, reject) => {
        const allRepos = [];
        let page = 1;
        let hasMore = true;
        
        while (hasMore) {
            const url = `https://api.github.com/users/st-mn/repos?page=${page}&per_page=100`;
            try {
                const res = await new Promise((res, rej) => {
                    https.get(url, { headers: { 'User-Agent': 'Node.js' } }, (response) => {
                        let data = '';
                        response.on('data', (chunk) => data += chunk);
                        response.on('end', () => {
                            if (response.statusCode === 200) {
                                res(JSON.parse(data));
                            } else {
                                rej(new Error(`Error: ${response.statusCode}`));
                            }
                        });
                    }).on('error', rej);
                });
                
                if (res.length === 0) {
                    hasMore = false;
                } else {
                    allRepos.push(...res);
                    page++;
                }
            } catch (error) {
                reject(error);
                return;
            }
        }
        
        resolve(allRepos);
    });
}

function categorizeRepo(repo) {
    const topics = repo.topics || [];
    const name = repo.name.toLowerCase();
    const desc = (repo.description || '').toLowerCase();
    const text = `${name} ${desc} ${topics.join(' ')}`;
    
    // Simple keyword-based scoring (acting as a basic ML classifier)
    const scores = {
        'Information Security': 0,
        'Machine Learning': 0,
        'Blockchain Stuff': 0,
        'Other-Stuff': 0
    };
    
    // Information Security keywords
    const secKeywords = ['security', 'infosec', 'cybersecurity', 'pentest', 'hacking', 'vulnerability', 'exploit', 'malware', 'encryption', 'authentication', 'firewall', 'threat', 'attack', 'defense', 'privacy', 'forensic', 'audit', 'sigma', 'hackernews', 'hacker', 'autodr', 'autobook', 'signal'];
    secKeywords.forEach(k => {
        if (text.includes(k)) scores['Information Security'] += 1;
    });
    
    // Machine Learning keywords
    const mlKeywords = ['machine-learning', 'ml', 'ai', 'artificial-intelligence', 'data-science', 'neural', 'deep-learning', 'tensorflow', 'pytorch', 'keras', 'scikit', 'pandas', 'numpy', 'computer-vision', 'nlp', 'prediction', 'model', 'algorithm', 'training', 'classification', 'regression', 'open', 'assistant', 'detection', 'xr', 'video', 'lense'];
    mlKeywords.forEach(k => {
        if (text.includes(k)) scores['Machine Learning'] += 1;
    });
    
    // Blockchain keywords
    const bcKeywords = ['blockchain', 'crypto', 'cryptocurrency', 'web3', 'solidity', 'ethereum', 'bitcoin', 'smart-contract', 'defi', 'nft', 'dapp', 'token', 'wallet', 'mining', 'consensus', 'hardhat', 'chainlink', 'datastreams', 'ens', 'near', 'perps', 'perp', 'tbot', 'pancake', 'smartcontract', 'lottery', 'openweathermap', 'ea', 'ao'];
    bcKeywords.forEach(k => {
        if (text.includes(k)) scores['Blockchain Stuff'] += 1;
    });
    
    // Find the category with the highest score
    let maxScore = 0;
    let category = 'Other-Stuff';  // Default
    for (const cat in scores) {
        if (scores[cat] > maxScore) {
            maxScore = scores[cat];
            category = cat;
        }
    }
    
    // Special cases
    if (name === 'demo-microsaas' || name === 'reg-boa' || name === 'docker-python-chromedriver' || name === 'perpDEX' || name === 'perpdex' || name === 'django-bot' || name === 'spring-boot-microservices-example') {
        category = 'Other-Stuff';
    }
    
    // If no keywords match, still assign to default
    return category;
}

function generateMarkdown(categories) {
    let md = "";
    md += '<div style="text-align: center;">\n<table style="width: 100%; margin: auto;">\n';
    md += '<tr>\n';
    md += '<th style="text-align:center"><img src="icon-is.png" alt="IS" width="20"> Information-Security</th>\n';
    md += '<th style="text-align:center"><img src="icon-ml.png" alt="ML" width="20"> Machine-Learning</th>\n';
    md += '<th style="text-align:center"><img src="icon-bc.png" alt="BC" width="20"> Blockchain-Stuff</th>\n';
    md += '<th style="text-align:center"><img src="icon-ot.png" alt="OT" width="20"> Other-Stuff</th>\n';
    md += '</tr>\n';
    
    const maxLen = Math.max(
        categories['Information Security'].length,
        categories['Machine Learning'].length,
        categories['Blockchain Stuff'].length,
        categories['Other-Stuff'].length
    );
    
    for (let i = 0; i < maxLen; i++) {
        md += '<tr>\n';
        for (const cat of ['Information Security', 'Machine Learning', 'Blockchain Stuff', 'Other-Stuff']) {
            const repos = categories[cat];
            if (i < repos.length) {
                const repo = repos[i];
                const parts = repo.name.split('-');
                let displayName = parts.slice(0, 2).join('-');
                if (repo.name === 'spring-boot-microservices-example') displayName = 'java-microservices';
                const title = `<a href="${repo.html_url}">${displayName}</a>`;
                let desc = (repo.description || '').substring(0, 50);
                if (!desc) {
                    if (cat === 'Information Security') desc = 'Security project';
                    else if (cat === 'Machine Learning') desc = 'ML project';
                    else if (cat === 'Blockchain Stuff') desc = 'Blockchain project';
                    else if (cat === 'Other-Stuff') desc = 'Other project';
                }
                md += `<td style="text-align:center">${title}</td>\n`;
            } else {
                md += '<td></td>\n';
            }
        }
        md += '</tr>\n';
    }
    
    md += '</table>\n</div>\n';
    
    return md;
}

async function main() {
    try {
        const repos = await getRepos();
        
        // Read exclude list
        let excludeSet = new Set();
        if (fs.existsSync('exclude_repos.txt')) {
            const excludeData = fs.readFileSync('exclude_repos.txt', 'utf8');
            const excludeList = excludeData.split('\n').map(line => line.trim()).filter(line => line);
            excludeSet = new Set(excludeList);
        }
        
        const categories = {
            'Information Security': [],
            'Machine Learning': [],
            'Blockchain Stuff': [],
            'Other-Stuff': []
        };
        
        for (const repo of repos) {
            if (!repo.private && !excludeSet.has(repo.name)) {
                const cat = categorizeRepo(repo);
                categories[cat].push(repo);
            }
        }
        
        // Sort by latest commit date (pushed_at), most recent first
        for (const cat in categories) {
            categories[cat].sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
        }
        
        const md = generateMarkdown(categories);
        
        fs.writeFileSync('README.md', md);
        
        console.log("README.md updated");
    } catch (error) {
        console.error(error);
    }
}

main();