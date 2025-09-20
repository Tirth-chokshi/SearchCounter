// Run this in browser console on generate_icons.html to create base64 icons
function createIconsBase64() {
    const sizes = [16, 32, 48, 128];
    const icons = {};
    
    sizes.forEach(size => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, '#ff6b6b');
        gradient.addColorStop(1, '#ee5a24');
        
        // Draw rounded rectangle
        const radius = size * 0.15;
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(size - radius, 0);
        ctx.quadraticCurveTo(size, 0, size, radius);
        ctx.lineTo(size, size - radius);
        ctx.quadraticCurveTo(size, size, size - radius, size);
        ctx.lineTo(radius, size);
        ctx.quadraticCurveTo(0, size, 0, size - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // White circle badge
        const badgeX = size * 0.55;
        const badgeY = size * 0.45;
        const badgeSize = size * 0.4;
        
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, badgeSize * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        
        // Number "1"
        ctx.fillStyle = '#ee5a24';
        ctx.font = `bold ${badgeSize * 0.8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('1', badgeX, badgeY);
        
        icons[size] = canvas.toDataURL();
    });
    
    console.log('Copy these base64 strings to create PNG files:');
    Object.keys(icons).forEach(size => {
        console.log(`${size}x${size}:`, icons[size]);
    });
}

createIconsBase64();
