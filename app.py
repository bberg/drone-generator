from flask import Flask, render_template, send_from_directory, Response
from datetime import datetime
import os

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/science')
def science():
    return render_template('science.html', active_page='science')

@app.route('/applications')
def applications():
    return render_template('applications.html', active_page='applications')

@app.route('/traditions')
def traditions():
    return render_template('traditions.html', active_page='traditions')

@app.route('/faq')
def faq():
    return render_template('faq.html', active_page='faq')

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                             'favicon.svg', mimetype='image/svg+xml')

@app.route('/ads.txt')
def ads_txt():
    return Response('google.com, pub-5035585454948958, DIRECT, f08c47fec0942fa0\n',
                    mimetype='text/plain')

# SEO: Sitemap
@app.route('/sitemap.xml')
def sitemap():
    """Generate dynamic sitemap for SEO"""
    today = datetime.now().strftime('%Y-%m-%d')

    sitemap_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://omtones.com/</loc>
        <lastmod>{today}</lastmod>
        <priority>1.0</priority>
        <changefreq>weekly</changefreq>
    </url>
    <url>
        <loc>https://omtones.com/science</loc>
        <lastmod>{today}</lastmod>
        <priority>0.9</priority>
        <changefreq>monthly</changefreq>
    </url>
    <url>
        <loc>https://omtones.com/applications</loc>
        <lastmod>{today}</lastmod>
        <priority>0.9</priority>
        <changefreq>monthly</changefreq>
    </url>
    <url>
        <loc>https://omtones.com/traditions</loc>
        <lastmod>{today}</lastmod>
        <priority>0.9</priority>
        <changefreq>monthly</changefreq>
    </url>
    <url>
        <loc>https://omtones.com/faq</loc>
        <lastmod>{today}</lastmod>
        <priority>0.9</priority>
        <changefreq>monthly</changefreq>
    </url>
</urlset>'''

    return Response(sitemap_xml, mimetype='application/xml')

# SEO: Robots.txt
@app.route('/robots.txt')
def robots():
    """Serve robots.txt for SEO"""
    robots_txt = '''User-agent: *
Allow: /
Sitemap: https://omtones.com/sitemap.xml

# Crawl delay for politeness
Crawl-delay: 1'''

    return Response(robots_txt, mimetype='text/plain')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8004))
    app.run(host='0.0.0.0', port=port)

# Redeploy trigger: 20260119104038
