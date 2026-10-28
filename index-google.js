const fs = require('fs');
const path = require('path');
let matter;

try {
  matter = require('gray-matter');
} catch (e) {
  console.log("Gray-matter belum siap, coba langkah bypass...");
}

const axios = require('axios');
const { google } = require('googleapis');

const contentDir = './content'; 
const domain = "https://katrok.vercel.app";
const mediamu = "Katrok";

let xmlEntries = '';
let urlsToNotify = [];

function readDir(dir) {
  if (!fs.existsSync(dir) || !matter) return;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      readDir(filePath);
    } else if (file.endsWith('.md')) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const { data } = matter(fileContent);
        
        if (data.date) {
          const postDate = new Date(data.date);
          const now = new Date();
          const diffTime = Math.abs(now - postDate);
          const diffDays = diffTime / (1000 * 60 * 60 * 24);
          
          if (diffDays <= 2) {
            const slug = data.slug || path.basename(file, '.md');
            const permalink = `${domain}/${slug}/`;
            const formattedDate = postDate.toISOString();
            const imgUrl = data.image || "https://katrok.vercel.app/image/katrok.webp";

            urlsToNotify.push(permalink);
            xmlEntries += `  <url>
    <loc>${permalink}</loc>
    <news:news>
      <news:publication>
        <news:name>${mediamu}</news:name>
        <news:language>id</news:language>
      </news:publication>
      <news:publication_date>${formattedDate}</news:publication_date>
      <news:title>${data.title || "No Title"}</news:title>
    </news:news>
  </url>\n`;
          }
        }
      } catch (err) {
        console.log(`Gagal membaca file: ${file}`);
      }
    }
  });
}

readDir(contentDir);

const publicSitemapPath = './public/sitemap-news.xml';
if (fs.existsSync('./public')) {
  const fullXml = `<?xml version="1.0" encoding="utf-8" ?>
<?xml-stylesheet type="text/xsl" href="/sitemap-news-style.xsl" ?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
\n${xmlEntries}</urlset>`;
  
  fs.writeFileSync(publicSitemapPath, fullXml, 'utf8');
  console.log(`[SUKSES BUILD] Sitemap-news.xml dinamis otomatis siap!`);
}

if (urlsToNotify.length > 0 && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  try {
    const keyData = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const jwtClient = new google.auth.JWT(
      keyData.client_email, null, keyData.private_key,
      ['https://googleapis.com'], null
    );

    jwtClient.authorize(async (err, tokens) => {
      if (err) {
        console.error("Gagal otentikasi Google API:", err.message);
        process.exit(0);
      }
      for (const url of urlsToNotify) {
        try {
          await axios.post(
            'https://googleapis.com',
            { url: url, type: 'URL_UPDATED' },
            { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokens.access_token}` } }
          );
          console.log(`[SUKSES API] URL terkirim: ${url}`);
        } catch (apiErr) {
          console.error(`[INFO API] Skip URL: ${url}`);
        }
      }
      process.exit(0);
    });
  } catch (jsonErr) {
    console.log("[INFO] Kunci API belum dibaca sempurna atau kosong. Safe bypass aktif.");
    process.exit(0);
  }
} else {
  console.log("[INFO] Tidak ada artikel baru dalam 2 hari ini atau environment key kosong. Safe exit aktif.");
  process.exit(0);
}
