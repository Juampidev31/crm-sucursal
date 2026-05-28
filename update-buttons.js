const fs = require('fs');
let code = fs.readFileSync('src/app/ajustes/ResumenMensualTab.tsx', 'utf8');

// 1. Remove Zoom block
const zoomRegex = /<div style=\{\{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba\(255,255,255,0\.02\)'.*?<\/select>\s*<\/div>/s;
code = code.replace(zoomRegex, '');

// 2. Replace Generar Link button style
const generarLinkRegex = /<button\s+onClick=\{handleGenerarLink\}\s+style=\{\{\s*display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12,\s*border: '1px solid rgba\(52,211,153,0\.2\)', background: 'rgba\(16, 185, 129, 0\.04\)',\s*color: '#00ff88'.*?<\/button>/s;

const newGenerarLink = `<button
              onClick={handleGenerarLink}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, 
                border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', 
                color: '#fff', fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 800, 
                cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                textTransform: 'uppercase', letterSpacing: '1px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
              Generar Link
            </button>`;

code = code.replace(generarLinkRegex, newGenerarLink);

// 3. Replace Guardar Resumen button style
const guardarResumenRegex = /<button\s+onClick=\{handleGuardar\}\s+disabled=\{saving\}\s+style=\{\{\s*display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', borderRadius: 12,\s*border: 'none', background: '#fff',\s*color: '#000'.*?<\/button>/s;

const newGuardarResumen = `<button
              onClick={handleGuardar}
              disabled={saving}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', borderRadius: 12, 
                border: '1px solid rgba(16, 185, 129, 0.4)', background: '#10b981', 
                color: '#fff', fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 900, 
                cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                textTransform: 'uppercase', letterSpacing: '1.2px',
                opacity: saving ? 0.7 : 1,
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.2)'
              }}
              onMouseEnter={(e) => {
                if (!saving) {
                  e.currentTarget.style.background = '#059669';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 40px rgba(16, 185, 129, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#10b981';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.2)';
              }}
            >
              <Save size={16} strokeWidth={2.5} />
              {saving ? 'Guardando...' : \`Guardar Resumen\`}
            </button>`;

code = code.replace(guardarResumenRegex, newGuardarResumen);

fs.writeFileSync('src/app/ajustes/ResumenMensualTab.tsx', code);
console.log('Buttons updated!');
