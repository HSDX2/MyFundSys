import React from 'react';

interface ActionCardProps {
  icon: string;
  title: string;
  description: string;
  ctaText: string;
  onClick: () => void;
}

const ActionCard: React.FC<ActionCardProps> = ({ icon, title, description, ctaText, onClick }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: '#fff',
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 200,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 24 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{description}</div>
      </div>
      <div
        onClick={onClick}
        style={{
          fontSize: 13,
          color: '#1677ff',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          padding: '4px 10px',
          borderRadius: 6,
          background: '#f0f5ff',
        }}
      >
        {ctaText}
      </div>
    </div>
  );
};

export default ActionCard;
