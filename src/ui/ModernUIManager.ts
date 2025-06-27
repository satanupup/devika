import * as vscode from 'vscode';

export interface ThemeConfig {
    name: string;
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        surface: string;
        text: string;
        textSecondary: string;
        border: string;
        success: string;
        warning: string;
        error: string;
    };
    animations: {
        duration: string;
        easing: string;
    };
}

export interface UIComponent {
    id: string;
    type: 'panel' | 'dialog' | 'notification' | 'sidebar';
    title: string;
    content: string;
    actions?: UIAction[];
    theme?: string;
    responsive?: boolean;
}

export interface UIAction {
    id: string;
    label: string;
    icon?: string;
    primary?: boolean;
    callback: () => void | Promise<void>;
}

export class ModernUIManager {
    private themes: Map<string, ThemeConfig> = new Map();
    private currentTheme: string = 'default';
    private components: Map<string, UIComponent> = new Map();
    private animationsEnabled = true;

    constructor(private context: vscode.ExtensionContext) {
        this.initializeDefaultThemes();
        // this.loadUserPreferences(); // TODO: Implement user preferences loading
    }

    private initializeDefaultThemes(): void {
        // Default Light Theme
        this.themes.set('default', {
            name: 'Default Light',
            colors: {
                primary: '#007ACC',
                secondary: '#6C757D',
                accent: '#17A2B8',
                background: '#FFFFFF',
                surface: '#F8F9FA',
                text: '#212529',
                textSecondary: '#6C757D',
                border: '#DEE2E6',
                success: '#28A745',
                warning: '#FFC107',
                error: '#DC3545'
            },
            animations: {
                duration: '0.3s',
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
            }
        });

        // Dark Theme
        this.themes.set('dark', {
            name: 'Dark',
            colors: {
                primary: '#0E639C',
                secondary: '#495057',
                accent: '#17A2B8',
                background: '#1E1E1E',
                surface: '#2D2D30',
                text: '#CCCCCC',
                textSecondary: '#969696',
                border: '#3E3E42',
                success: '#4EC9B0',
                warning: '#FFCC02',
                error: '#F44747'
            },
            animations: {
                duration: '0.3s',
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
            }
        });

        // High Contrast Theme
        this.themes.set('high-contrast', {
            name: 'High Contrast',
            colors: {
                primary: '#FFFFFF',
                secondary: '#C0C0C0',
                accent: '#FFFF00',
                background: '#000000',
                surface: '#1A1A1A',
                text: '#FFFFFF',
                textSecondary: '#C0C0C0',
                border: '#FFFFFF',
                success: '#00FF00',
                warning: '#FFFF00',
                error: '#FF0000'
            },
            animations: {
                duration: '0.1s',
                easing: 'linear'
            }
        });

        // Modern Blue Theme
        this.themes.set('modern-blue', {
            name: 'Modern Blue',
            colors: {
                primary: '#2563EB',
                secondary: '#64748B',
                accent: '#06B6D4',
                background: '#F8FAFC',
                surface: '#FFFFFF',
                text: '#0F172A',
                textSecondary: '#475569',
                border: '#E2E8F0',
                success: '#10B981',
                warning: '#F59E0B',
                error: '#EF4444'
            },
            animations: {
                duration: '0.25s',
                easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }
        });
    }

    async createModernPanel(
        id: string,
        title: string,
        content: string,
        options?: {
            viewColumn?: vscode.ViewColumn;
            preserveFocus?: boolean;
            theme?: string;
            responsive?: boolean;
        }
    ): Promise<vscode.WebviewPanel> {
        const panel = vscode.window.createWebviewPanel(
            id,
            title,
            options?.viewColumn || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.context.extensionUri]
            }
        );

        const theme = this.themes.get(options?.theme || this.currentTheme);
        panel.webview.html = this.generateModernHTML(content, theme, {
            title,
            responsive: options?.responsive ?? true
        });

        return panel;
    }

    private generateModernHTML(
        content: string,
        theme?: ThemeConfig,
        options?: { title?: string; responsive?: boolean }
    ): string {
        const currentTheme = theme || this.themes.get(this.currentTheme)!;

        return `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${options?.title || 'Devika'}</title>
            <style>
                ${this.generateModernCSS(currentTheme, options?.responsive)}
            </style>
        </head>
        <body>
            <div class="app-container">
                <div class="content-wrapper">
                    ${content}
                </div>
            </div>
            <script>
                ${this.generateModernJS()}
            </script>
        </body>
        </html>
        `;
    }

    private generateModernCSS(theme: ThemeConfig, responsive = true): string {
        return `
        :root {
            --primary-color: ${theme.colors.primary};
            --secondary-color: ${theme.colors.secondary};
            --accent-color: ${theme.colors.accent};
            --background-color: ${theme.colors.background};
            --surface-color: ${theme.colors.surface};
            --text-color: ${theme.colors.text};
            --text-secondary-color: ${theme.colors.textSecondary};
            --border-color: ${theme.colors.border};
            --success-color: ${theme.colors.success};
            --warning-color: ${theme.colors.warning};
            --error-color: ${theme.colors.error};
            --animation-duration: ${theme.animations.duration};
            --animation-easing: ${theme.animations.easing};

            --border-radius: 8px;
            --border-radius-sm: 4px;
            --border-radius-lg: 12px;
            --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
            --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: var(--background-color);
            color: var(--text-color);
            line-height: 1.6;
            font-size: 14px;
            overflow-x: hidden;
        }

        .app-container {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .content-wrapper {
            flex: 1;
            padding: 20px;
            max-width: 100%;
            margin: 0 auto;
        }

        /* Modern Button Styles */
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px 16px;
            border: none;
            border-radius: var(--border-radius);
            font-size: 14px;
            font-weight: 500;
            text-decoration: none;
            cursor: pointer;
            transition: all var(--animation-duration) var(--animation-easing);
            position: relative;
            overflow: hidden;
        }

        .btn:before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left var(--animation-duration) var(--animation-easing);
        }

        .btn:hover:before {
            left: 100%;
        }

        .btn-primary {
            background-color: var(--primary-color);
            color: white;
        }

        .btn-primary:hover {
            background-color: color-mix(in srgb, var(--primary-color) 85%, black);
            transform: translateY(-1px);
            box-shadow: var(--shadow-lg);
        }

        .btn-secondary {
            background-color: var(--surface-color);
            color: var(--text-color);
            border: 1px solid var(--border-color);
        }

        .btn-secondary:hover {
            background-color: var(--border-color);
            transform: translateY(-1px);
        }

        /* Modern Card Styles */
        .card {
            background-color: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-sm);
            transition: all var(--animation-duration) var(--animation-easing);
            overflow: hidden;
        }

        .card:hover {
            box-shadow: var(--shadow);
            transform: translateY(-2px);
        }

        .card-header {
            padding: 16px 20px;
            border-bottom: 1px solid var(--border-color);
            background-color: color-mix(in srgb, var(--surface-color) 95%, var(--primary-color));
        }

        .card-body {
            padding: 20px;
        }

        .card-footer {
            padding: 16px 20px;
            border-top: 1px solid var(--border-color);
            background-color: color-mix(in srgb, var(--surface-color) 98%, var(--border-color));
        }

        /* Modern Form Styles */
        .form-group {
            margin-bottom: 20px;
        }

        .form-label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: var(--text-color);
        }

        .form-control {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            background-color: var(--surface-color);
            color: var(--text-color);
            font-size: 14px;
            transition: all var(--animation-duration) var(--animation-easing);
        }

        .form-control:focus {
            outline: none;
            border-color: var(--primary-color);
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 20%, transparent);
        }

        /* Modern Loading Animation */
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid var(--border-color);
            border-radius: 50%;
            border-top-color: var(--primary-color);
            animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* Modern Progress Bar */
        .progress {
            width: 100%;
            height: 8px;
            background-color: var(--border-color);
            border-radius: var(--border-radius);
            overflow: hidden;
        }

        .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, var(--primary-color), var(--accent-color));
            border-radius: var(--border-radius);
            transition: width var(--animation-duration) var(--animation-easing);
            position: relative;
        }

        .progress-bar:after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            right: 0;
            background-image: linear-gradient(
                -45deg,
                rgba(255, 255, 255, .2) 25%,
                transparent 25%,
                transparent 50%,
                rgba(255, 255, 255, .2) 50%,
                rgba(255, 255, 255, .2) 75%,
                transparent 75%,
                transparent
            );
            background-size: 50px 50px;
            animation: move 2s linear infinite;
        }

        @keyframes move {
            0% { background-position: 0 0; }
            100% { background-position: 50px 50px; }
        }

        /* Modern Alert Styles */
        .alert {
            padding: 16px 20px;
            border-radius: var(--border-radius);
            margin-bottom: 20px;
            border-left: 4px solid;
            position: relative;
            overflow: hidden;
        }

        .alert-success {
            background-color: color-mix(in srgb, var(--success-color) 10%, var(--surface-color));
            border-left-color: var(--success-color);
            color: var(--success-color);
        }

        .alert-warning {
            background-color: color-mix(in srgb, var(--warning-color) 10%, var(--surface-color));
            border-left-color: var(--warning-color);
            color: var(--warning-color);
        }

        .alert-error {
            background-color: color-mix(in srgb, var(--error-color) 10%, var(--surface-color));
            border-left-color: var(--error-color);
            color: var(--error-color);
        }

        /* Responsive Design */
        ${responsive ? `
        @media (max-width: 768px) {
            .content-wrapper {
                padding: 16px;
            }

            .btn {
                padding: 12px 16px;
                font-size: 16px;
            }

            .card-body {
                padding: 16px;
            }

            .form-control {
                padding: 14px 16px;
                font-size: 16px;
            }
        }

        @media (max-width: 480px) {
            .content-wrapper {
                padding: 12px;
            }

            .card-header,
            .card-footer {
                padding: 12px 16px;
            }

            .card-body {
                padding: 16px;
            }
        }
        ` : ''}

        /* Animation Classes */
        .fade-in {
            animation: fadeIn var(--animation-duration) var(--animation-easing);
        }

        .slide-in-up {
            animation: slideInUp var(--animation-duration) var(--animation-easing);
        }

        .scale-in {
            animation: scaleIn var(--animation-duration) var(--animation-easing);
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes scaleIn {
            from {
                opacity: 0;
                transform: scale(0.9);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        /* Utility Classes */
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .mb-0 { margin-bottom: 0; }
        .mb-1 { margin-bottom: 8px; }
        .mb-2 { margin-bottom: 16px; }
        .mb-3 { margin-bottom: 24px; }
        .mt-0 { margin-top: 0; }
        .mt-1 { margin-top: 8px; }
        .mt-2 { margin-top: 16px; }
        .mt-3 { margin-top: 24px; }
        .p-0 { padding: 0; }
        .p-1 { padding: 8px; }
        .p-2 { padding: 16px; }
        .p-3 { padding: 24px; }
        .d-flex { display: flex; }
        .d-block { display: block; }
        .d-none { display: none; }
        .justify-center { justify-content: center; }
        .justify-between { justify-content: space-between; }
        .align-center { align-items: center; }
        .gap-1 { gap: 8px; }
        .gap-2 { gap: 16px; }
        .gap-3 { gap: 24px; }
        `;
    }

    private generateModernJS(): string {
        return `
        // Modern UI JavaScript utilities
        const vscode = acquireVsCodeApi();

        // Animation utilities
        function animateElement(element, animationClass, duration = 300) {
            return new Promise((resolve) => {
                element.classList.add(animationClass);
                setTimeout(() => {
                    element.classList.remove(animationClass);
                    resolve();
                }, duration);
            });
        }

        // Smooth scroll utility
        function smoothScrollTo(element, duration = 300) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }

        // Loading state utility
        function setLoadingState(button, loading = true) {
            if (loading) {
                button.disabled = true;
                button.innerHTML = '<span class="loading"></span> 處理中...';
            } else {
                button.disabled = false;
                button.innerHTML = button.dataset.originalText || '確定';
            }
        }

        // Progress bar utility
        function updateProgress(progressBar, percentage) {
            progressBar.style.width = percentage + '%';
        }

        // Alert utility
        function showAlert(message, type = 'info', duration = 5000) {
            const alertContainer = document.getElementById('alert-container') || createAlertContainer();

            const alert = document.createElement('div');
            alert.className = \`alert alert-\${type} fade-in\`;
            alert.innerHTML = message;

            alertContainer.appendChild(alert);

            setTimeout(() => {
                alert.style.opacity = '0';
                setTimeout(() => {
                    alertContainer.removeChild(alert);
                }, 300);
            }, duration);
        }

        function createAlertContainer() {
            const container = document.createElement('div');
            container.id = 'alert-container';
            container.style.position = 'fixed';
            container.style.top = '20px';
            container.style.right = '20px';
            container.style.zIndex = '9999';
            container.style.maxWidth = '400px';
            document.body.appendChild(container);
            return container;
        }

        // Form validation utility
        function validateForm(form) {
            const inputs = form.querySelectorAll('.form-control[required]');
            let isValid = true;

            inputs.forEach(input => {
                if (!input.value.trim()) {
                    input.classList.add('is-invalid');
                    isValid = false;
                } else {
                    input.classList.remove('is-invalid');
                }
            });

            return isValid;
        }

        // Theme switching utility
        function switchTheme(themeName) {
            vscode.postMessage({
                command: 'switchTheme',
                theme: themeName
            });
        }

        // Initialize modern UI features
        document.addEventListener('DOMContentLoaded', function() {
            // Add animation classes to elements as they come into view
            const observerOptions = {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            };

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('fade-in');
                    }
                });
            }, observerOptions);

            // Observe all cards and major elements
            document.querySelectorAll('.card, .alert, .form-group').forEach(el => {
                observer.observe(el);
            });

            // Add ripple effect to buttons
            document.querySelectorAll('.btn').forEach(button => {
                button.addEventListener('click', function(e) {
                    const ripple = document.createElement('span');
                    const rect = this.getBoundingClientRect();
                    const size = Math.max(rect.width, rect.height);
                    const x = e.clientX - rect.left - size / 2;
                    const y = e.clientY - rect.top - size / 2;

                    ripple.style.width = ripple.style.height = size + 'px';
                    ripple.style.left = x + 'px';
                    ripple.style.top = y + 'px';
                    ripple.classList.add('ripple');

                    this.appendChild(ripple);

                    setTimeout(() => {
                        ripple.remove();
                    }, 600);
                });
            });

            // Form enhancements
            document.querySelectorAll('.form-control').forEach(input => {
                input.addEventListener('focus', function() {
                    this.parentElement.classList.add('focused');
                });

                input.addEventListener('blur', function() {
                    this.parentElement.classList.remove('focused');
                    if (this.hasAttribute('required') && !this.value.trim()) {
                        this.classList.add('is-invalid');
                    } else {
                        this.classList.remove('is-invalid');
                    }
                });
            });
        });

        // CSS for ripple effect
        const rippleCSS = \`
        .btn {
            position: relative;
            overflow: hidden;
        }

        .ripple {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.6);
            transform: scale(0);
            animation: ripple-animation 0.6s linear;
            pointer-events: none;
        }

        @keyframes ripple-animation {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }

        .form-group.focused .form-label {
            color: var(--primary-color);
        }

        .form-control.is-invalid {
            border-color: var(--error-color);
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--error-color) 20%, transparent);
        }
        \`;

        const style = document.createElement('style');
        style.textContent = rippleCSS;
        document.head.appendChild(style);
        `;
    }
}