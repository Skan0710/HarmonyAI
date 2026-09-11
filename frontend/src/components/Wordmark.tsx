import React from 'react';
import { Link } from 'react-router-dom';
import { TextRoll } from './ui/TextRoll';

interface WordmarkProps {
  className?: string;
  onClick?: () => void;
}

export const Wordmark: React.FC<WordmarkProps> = ({ className = 'text-lg', onClick }) => (
  <Link to="/" onClick={onClick} className={`font-display italic text-text-primary tracking-tight inline-flex ${className}`}>
    <TextRoll>Harmony</TextRoll>
    <TextRoll className="text-accent not-italic">AI</TextRoll>
  </Link>
);
