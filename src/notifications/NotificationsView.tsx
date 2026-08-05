// Historial completo de notificaciones.
//
// Es lo que se abre desde "Ver más notificaciones": la campanita muestra
// solo las 10 primeras, y aqui estan todas, con el detalle de quienes son
// los implicados y filtros por tipo y por estado de lectura.

import { useMemo, useState } from 'react';
import type { AppNotification, Priority, TargetTab } from './engine';

interface Props {
  language: 'es' | 'en';
  notifications: AppNotification[];
  seen: Set<string>;
  onNavigate: (tab: TargetTab) => void;
  onMarkAllRead: () => void;
}

const PRIORITY_COLOR: Record<Priority, string> = {
  high: '#f87171',
  normal: '#60a5fa',
  low: '#94a3b8',
};

export function NotificationsView({ language, notifications, seen, onNavigate, onMarkAllRead }: Props) {
  const es = language === 'es';
  const [filter, setFilter] = useState<'all' | 'unread' | Priority>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const unreadCount = notifications.filter(n => !seen.has(n.id)).length;

  const visible = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !seen.has(n.id));
    return notifications.filter(n => n.priority === filter);
  }, [notifications, filter, seen]);

  const priorityLabel: Record<Priority, string> = {
    high: es ? 'Urgente' : 'Urgent',
    normal: es ? 'Normal' : 'Normal',
    low: es ? 'Revisar' : 'Review',
  };

  const filters: { key: 'all' | 'unread' | Priority; label: string }[] = [
    { key: 'all', label: `${es ? 'Todas' : 'All'} (${notifications.length})` },
    { key: 'unread', label: `${es ? 'Sin leer' : 'Unread'} (${unreadCount})` },
    { key: 'high', label: `🔴 ${priorityLabel.high}` },
    { key: 'normal', label: `🔵 ${priorityLabel.normal}` },
    { key: 'low', label: `⚪ ${priorityLabel.low}` },
  ];

  return (
    <>
      <div className="glass-card" style={{ padding: '18px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0 }}>🔔 {es ? 'Historial de notificaciones' : 'Notification history'}</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {es
                ? 'Se calculan del estado actual del negocio. Al resolver lo que las causa, desaparecen solas.'
                : 'Derived from the current state of the business. They disappear once the underlying issue is resolved.'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button className="btn-secondary btn-xs" onClick={onMarkAllRead}>
              ✓ {es ? 'Marcar todas como leídas' : 'Mark all as read'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button
              key={f.key}
              className={filter === f.key ? 'btn-primary btn-xs' : 'btn-secondary btn-xs'}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            {filter === 'unread'
              ? (es ? 'No hay notificaciones sin leer.' : 'No unread notifications.')
              : (es ? 'No hay nada pendiente. Todo al día.' : 'Nothing pending. All clear.')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visible.map(n => {
            const isNew = !seen.has(n.id);
            const isOpen = expanded.has(n.id);
            return (
              <div
                key={n.id}
                className="glass-card"
                style={{
                  padding: '14px 16px',
                  borderLeft: `3px solid ${PRIORITY_COLOR[n.priority]}`,
                  background: isNew ? 'rgba(96,165,250,0.06)' : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '20px', lineHeight: 1.2 }}>{n.icon}</span>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-bright)', fontSize: '14px' }}>{n.title}</span>
                      {isNew && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#60a5fa', background: 'rgba(96,165,250,0.15)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '.04em' }}>
                          {es ? 'NUEVA' : 'NEW'}
                        </span>
                      )}
                    </div>
                    {n.detail && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>{n.detail}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {n.count > 1 && (
                      <button className="btn-secondary btn-xs" onClick={() => toggle(n.id)}>
                        {isOpen ? `▲ ${es ? 'Ocultar' : 'Hide'}` : `▼ ${es ? `Ver los ${n.count}` : `View all ${n.count}`}`}
                      </button>
                    )}
                    <button className="btn-primary btn-xs" onClick={() => onNavigate(n.target)}>
                      {es ? 'Ir a la vista' : 'Open view'} →
                    </button>
                  </div>
                </div>

                {(isOpen || n.count === 1) && (
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {n.items.map(it => (
                      <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '12px', padding: '4px 0' }}>
                        <span style={{ fontWeight: 600 }}>{it.label}</span>
                        {it.detail && <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>{it.detail}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
