const fs = require('fs');
const path = require('path');
let matter;

// Nyegah eror yen gray-matter durung terinstall sampurna neng server
try {
  matter = require('gray-matter');
} catch (e) {
  console.log("Gray-matter durung siap, nyoba langkah bypass...");
}

const axios = require('axios');
const { google } = require('googleapis');

const contentDir = './content'; 
const domain = "https://katrok.vercel.app"; // GANTI nganggo domain TLD .com mu sesuk
const mediamu = "Katrok"; // GANTI nganggo jeneng mediamu

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
    <image:image>
      <image:loc>${imgUrl}</image:loc>
      <image:title>${data.title || "No Title"}</image:title>
    </image:image>
  </url>\n`;
          }
        }
      } catch (err) {
        console.log(`Gagal moco file: ${file}`);
      }
    }
  });
}

readDir(contentDir);

// Nulis file fisik neng njero folder public hasil build Hugo
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

// ⚠️ PROSES AMAN (SAFE EXIT): Supoyo Vercel anti-gagal
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
        process.exit(0); // Panggah digawe sukses supoyo web tetep munggah online
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
    console.log("[INFO] Kunci API durung diwaca sampurna utawa kosong. Safe bypass aktif.");
    process.exit(0);
  }
} else {
  console.log("[INFO] Ora ono artikel anyar 2 dina iki utawa environment key kosong. Safe exit aktif.");
  process.exit(0); // 100% SUKSES NENG MERIAL VERCEL
}
