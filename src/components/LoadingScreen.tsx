import { useEffect, useState } from 'react';
import fernandaImg from '@/assets/fernanda-sarelli.jpg';

interface Props {
  message?: string;
}

export default function LoadingScreen({ message = 'Carregando...' }: Props) {
  const [dots, setDots] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots(d => (d.length >= 3 ? '' : d + '.'));
    }, 400);

    const progressInterval = setInterval(() => {
      setProgress(p => {
        if (p >= 85) return p;
        return p + Math.random() * 12;
      });
    }, 300);

    return () => {
      clearInterval(dotInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: '#070510' }}
    >
      {/* Glow de fundo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(236,72,153,0.08) 0%, transparent 70%)',
        }}
      />

      {/* Partículas decorativas */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${4 + i * 2}px`,
              height: `${4 + i * 2}px`,
              background: i % 2 === 0 ? 'rgba(236,72,153,0.4)' : 'rgba(244,63,94,0.3)',
              left: `${10 + i * 14}%`,
              top: `${15 + (i % 3) * 25}%`,
              animation: `float-${i % 3} ${3 + i}s ease-in-out infinite`,
              filter: 'blur(1px)',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-xs px-6">
        {/* Foto com anéis pulsantes */}
        <div className="relative flex items-center justify-center">
          {/* Anel externo pulsante */}
          <div
            className="absolute rounded-full"
            style={{
              width: '140px',
              height: '140px',
              border: '1px solid rgba(236,72,153,0.2)',
              animation: 'ring-pulse 2s ease-out infinite',
            }}
          />
          {/* Anel médio pulsante */}
          <div
            className="absolute rounded-full"
            style={{
              width: '116px',
              height: '116px',
              border: '1px solid rgba(236,72,153,0.3)',
              animation: 'ring-pulse 2s ease-out infinite 0.4s',
            }}
          />

          {/* Foto com borda gradiente */}
          <div className="relative w-24 h-24">
            <div
              className="absolute inset-0 rounded-full p-[2.5px]"
              style={{
                background: 'linear-gradient(135deg, #ec4899, #fb7185, #c026d3)',
                boxShadow: '0 0 24px rgba(236,72,153,0.5), 0 0 48px rgba(236,72,153,0.2)',
              }}
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-black">
                <img
                  src={fernandaImg}
                  alt="Dra. Fernanda Sarelli"
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>
            </div>
            {/* Indicador online */}
            <div
              className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-black"
              style={{ boxShadow: '0 0 6px rgba(16,185,129,0.6)' }}
            />
          </div>
        </div>

        {/* Nome e título */}
        <div className="text-center space-y-1">
          <h1 className="text-lg font-bold text-white tracking-tight">
            Dra. Fernanda Sarelli
          </h1>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: '#ec4899' }}
          >
            Cadastro de Lideranças
          </p>
        </div>

        {/* Mensagem de status */}
        <div className="text-center">
          <p className="text-sm text-white/60 font-medium min-w-[160px]">
            {message}
            <span className="inline-block w-6 text-left" style={{ color: '#ec4899' }}>
              {dots}
            </span>
          </p>
        </div>

        {/* Barra de progresso */}
        <div className="w-full">
          <div
            className="w-full h-[2px] rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${Math.min(progress, 85)}%`,
                background: 'linear-gradient(to right, #ec4899, #fb7185, #c026d3)',
                boxShadow: '0 0 8px rgba(236,72,153,0.6)',
              }}
            />
          </div>
        </div>

        {/* Indicador de atividade com pontos */}
        <div className="flex gap-1.5 items-center">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: i === 2 ? '8px' : '4px',
                height: i === 2 ? '8px' : '4px',
                background: i === 2 ? '#ec4899' : 'rgba(236,72,153,0.3)',
                animation: `dot-bounce 1.2s ease-in-out infinite`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>

        {/* Rodapé */}
        <p className="text-[10px] text-white/20 text-center">
          Rede política – Pré-candidata a Dep. Estadual · GO 2026
        </p>
      </div>

      <style>{`
        @keyframes ring-pulse {
          0%   { transform: scale(1);   opacity: 0.6; }
          70%  { transform: scale(1.15); opacity: 0; }
          100% { transform: scale(1.15); opacity: 0; }
        }
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: translateY(0);    opacity: 0.4; }
          40%            { transform: translateY(-5px); opacity: 1;   }
        }
        @keyframes float-0 {
          0%, 100% { transform: translateY(0px);   }
          50%       { transform: translateY(-12px); }
        }
        @keyframes float-1 {
          0%, 100% { transform: translateY(0px);  }
          50%       { transform: translateY(-8px); }
        }
        @keyframes float-2 {
          0%, 100% { transform: translateY(0px);   }
          50%       { transform: translateY(-16px); }
        }
      `}</style>
    </div>
  );
}
