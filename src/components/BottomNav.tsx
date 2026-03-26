import { PlusCircle, List, UserCircle, BarChart3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export type TabId = 'cadastrar' | 'liderancas' | 'perfil';

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export default function BottomNav({ active, onChange }: Props) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const tabs: { id: TabId; icon: typeof PlusCircle; label: string }[] = [
    { id: 'cadastrar', icon: PlusCircle, label: 'Cadastrar' },
    { id: 'liderancas', icon: List, label: isAdmin ? 'Todas' : 'Minhas' },
    { id: 'perfil', icon: UserCircle, label: 'Perfil' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-bottom">
      <div className="max-w-[672px] mx-auto flex justify-around items-center h-16">
        {tabs.map(({ id, icon: Icon, label }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all active:scale-90 ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={`text-[11px] ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
            </button>
          );
        })}
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all active:scale-90 text-muted-foreground"
          >
            <BarChart3 size={24} strokeWidth={1.5} />
            <span className="text-[11px] font-medium">Dashboard</span>
          </button>
        )}
      </div>
    </nav>
  );
}
