// ==========================================
// 1. KHỞI TẠO BẢN ĐỒ VÀ BẢN ĐỒ NỀN
// ==========================================
// Khởi tạo bản đồ tại module id="map-module"
const map = L.map('map-module', { zoomControl: false }).setView([10.7250, 106.6700], 14);

// Sử dụng giao diện Voyager của CartoCDN
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// Thêm nút Zoom tùy chỉnh về góc dưới bên phải
L.control.zoom({ position: 'bottomright' }).addTo(map);


// ==========================================
// 2. VẼ MẶT NẠ VÀ RANH GIỚI XÃ BÌNH HƯNG
// ==========================================
fetch('data/binh_hung.geojson')
    .then(res => {
        if (!res.ok) throw new Error("Không tìm thấy file ranh giới (binh_hung.geojson)");
        return res.json();
    })
    .then(data => {
        // Tạo mặt nạ bằng Turf.js
        const world = turf.bboxPolygon([-180, -90, 180, 90]);
        const binhHungPolygon = data.features[0]; 
        const mask = turf.difference(world, binhHungPolygon);

        // Vẽ lớp mặt nạ làm mờ khu vực ngoài xã
        L.geoJSON(mask, { 
            style: { fillColor: '#333', fillOpacity: 0.15, color: 'none', interactive: false } 
        }).addTo(map);

        // Vẽ viền nét đứt màu đỏ bao quanh ranh giới xã
        L.geoJSON(data, { 
            style: { color: '#d63031', weight: 3, dashArray: '8, 8', fillOpacity: 0, interactive: false } 
        }).addTo(map);

        // Tự động căn chỉnh bản đồ vừa vặn với ranh giới
        map.fitBounds(L.geoJSON(data).getBounds(), { padding: [20, 20] });
    })
    .catch(err => console.error("Lỗi vẽ ranh giới:", err));


// ==========================================
// 3. CẤU HÌNH CÁC PHÂN HỆ VÀ BỘ LỌC (LAYER CONTROL)
// ==========================================
const phanHeConfig = {
    'thu_gom_rac': { name: 'Khu vực thu gom rác', color: '#27ae60', icon: '♻️' },     // Xanh lá
    'diem_den_rac': { name: 'Điểm đen rác', color: '#c0392b', icon: '⚠️' },          // Đỏ
    'tram_phat_thanh': { name: 'Trạm phát thanh', color: '#f39c12', icon: '📢' },       // Cam
    'pano': { name: 'Cụm pano tuyên truyền', color: '#8e44ad', icon: '🖼️' },       // Tím
    'san_the_thao': { name: 'Sân thể dục thể thao', color: '#2980b9', icon: '⚽' }       // Xanh dương
};

const layerGroups = {};
const overlayMaps = {}; 

// Tạo các layer group và đưa vào danh sách bộ lọc
for (const key in phanHeConfig) {
    layerGroups[key] = L.layerGroup().addTo(map); // Bật mặc định tất cả các lớp
    
    // Tạo tên hiển thị có màu sắc trên Menu
    let filterName = `<span style="color:${phanHeConfig[key].color}; font-weight:bold; font-size:14px;">
                        ${phanHeConfig[key].icon} ${phanHeConfig[key].name}
                      </span>`;
    overlayMaps[filterName] = layerGroups[key];
}

// Thêm Control Bộ lọc vào góc phải trên cùng
L.control.layers(null, overlayMaps, { collapsed: false, position: 'topright' }).addTo(map);


// ==========================================
// 4. LẤY DỮ LIỆU TỪ VIETTEL HOSTING API
// ==========================================
// ⚠️ QUAN TRỌNG: Hãy thay URL dưới đây bằng link file api_get_map_data.php trên hosting của bạn
const API_URL = 'https://xabinhhung.gov.vn/api_get_map_data.php';

fetch(API_URL)
    .then(response => {
        if (!response.ok) throw new Error("Phản hồi từ máy chủ không hợp lệ");
        return response.json();
    })
    .then(data => {
        // Lặp qua từng sự kiện lấy được từ CSDL
        data.forEach(item => {
            const loai = item.loai_diem;
            if(!phanHeConfig[loai]) return; // Bỏ qua nếu dữ liệu không thuộc 5 phân hệ trên

            const config = phanHeConfig[loai];
            
            // Mã HTML tạo icon bo tròn, phát sáng nhẹ
            let iconHTML = `
                <div style="background-color: ${config.color}; width: 32px; height: 32px; 
                            border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5); 
                            display: flex; justify-content: center; align-items: center; 
                            font-size: 16px; color: white;">
                    ${config.icon}
                </div>`;
            
            let customIcon = L.divIcon({ 
                className: 'leaflet-div-icon', 
                html: iconHTML, 
                iconSize: [32, 32], 
                iconAnchor: [16, 16], 
                popupAnchor: [0, -16] 
            });
            
            let marker = L.marker([item.lat, item.lng], { icon: customIcon });
            
            // Thiết kế nội dung hộp thoại hiển thị khi click
            let popupContent = `
                <div style="min-width: 220px; font-family: Arial;">
                    <div style="background-color: ${config.color}; color: white; padding: 5px 8px; border-radius: 4px; font-size: 12px; margin-bottom: 8px; display: inline-block;">
                        ${config.icon} ${config.name}
                    </div>
                    <h4 style="margin: 0 0 8px 0; font-size: 16px; color: #333;">${item.tieu_de}</h4>
                    
                    ${item.hinh_anh ? `<img src="${item.hinh_anh}" style="width:100%; height: 120px; object-fit: cover; border-radius:4px; margin-bottom:8px; border: 1px solid #ddd;">` : ''}
                    
                    <p style="margin: 4px 0; font-size: 13px;">📍 <b>Địa chỉ:</b> ${item.dia_chi}</p>
                    <p style="margin: 4px 0; font-size: 13px;">⚙️ <b>Trạng thái:</b> <span style="font-weight:bold;">${item.trang_thai}</span></p>
                </div>
            `;
            marker.bindPopup(popupContent);
            
            // Gắn điểm marker vào đúng phân hệ (Layer) của nó
            layerGroups[loai].addLayer(marker);
        });
    })
    .catch(err => {
        console.warn("Lưu ý: Đang chạy mà không có dữ liệu API. Chi tiết lỗi:", err);
    });
