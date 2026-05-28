const fs = require('fs');
let code = fs.readFileSync('src/app/ajustes/ResumenMensualTab.tsx', 'utf8');

const guardarResumenRegex = /<button\s+onClick=\{handleGuardar\}\s+disabled=\{saving\}\s+style=\{\{\s*display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', borderRadius: 12,\s*border: '1px solid rgba\(16, 185, 129, 0\.4\)', background: '#10b981',\s*color: '#fff'.*?<\/button>/s;

const newGuardarResumen = `<button
              onClick={handleGuardar}
              disabled={saving}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', borderRadius: 12, 
                border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', 
                color: '#fff', fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 900, 
                cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                textTransform: 'uppercase', letterSpacing: '1.2px',
                opacity: saving ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!saving) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <Save size={16} strokeWidth={2.5} />
              {saving ? 'Guardando...' : \`Guardar Resumen\`}
            </button>`;

code = code.replace(guardarResumenRegex, newGuardarResumen);

fs.writeFileSync('src/app/ajustes/ResumenMensualTab.tsx', code);
console.log('Guardar Resumen button updated!');
