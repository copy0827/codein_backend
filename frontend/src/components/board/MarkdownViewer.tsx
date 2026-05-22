import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, className = '' }) => {
  return (
    <article className={`markdown-prose ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </article>
  );
};

export default MarkdownViewer;
