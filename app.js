// 初始化Supabase客户端
const SUPABASE_URL = "https://mirilhunybcsydhtowqo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcmlsaHVueWJjc3lkaHRvd3FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyNjk3MzEsImV4cCI6MjA1Njg0NTczMX0.fQCOraXJXQFshRXxHf2N-VIwTSbEc1hrxXzHP4sIIAw";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 定义DOM元素
const refreshBtn = document.getElementById('refresh-btn');
const lastUpdatedSpan = document.getElementById('last-updated');
const loadingDiv = document.getElementById('loading');
const statisticsTable = document.getElementById('model-statistics').querySelector('tbody');

// 刷新按钮点击事件
refreshBtn.addEventListener('click', () => {
    fetchProductionData();
});

// 从Supabase获取数据并处理
async function fetchProductionData() {
    try {
        // 显示加载中
        loadingDiv.style.display = 'block';
        statisticsTable.innerHTML = '';
        
        // 1. 获取model_series数据（产品型号与工艺分类的对应关系）
        const { data: modelSeries, error: modelSeriesError } = await supabase
            .from('model_series')
            .select('*');
            
        if (modelSeriesError) throw modelSeriesError;
        
        // 2. 获取series_processes数据（工艺分类对应的工艺流程）
        const { data: seriesProcesses, error: seriesProcessesError } = await supabase
            .from('series_processes')
            .select('*');
            
        if (seriesProcessesError) throw seriesProcessesError;
        
        // 3. 获取products数据（产品信息）
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('*');
            
        if (productsError) throw productsError;
        
        // 处理数据并展示
        processAndDisplayData(modelSeries, seriesProcesses, products);
        
        // 隐藏加载中提示
        loadingDiv.style.display = 'none';
        
        // 更新最后刷新时间
        const now = new Date();
        lastUpdatedSpan.textContent = `最后更新: ${now.toLocaleString()}`;
    } catch (error) {
        console.error('获取数据出错:', error);
        loadingDiv.textContent = `加载失败: ${error.message}`;
    }
}

// 处理数据并显示在表格中
function processAndDisplayData(modelSeries, seriesProcesses, products) {
    // 创建型号到工艺分类的映射
    const modelToSeries = {};
    modelSeries.forEach(item => {
        modelToSeries[item.model] = item.series;
    });
    
    // 创建工艺分类到工艺流程的映射
    const seriesToProcesses = {};
    seriesProcesses.forEach(item => {
        if (!seriesToProcesses[item.series]) {
            seriesToProcesses[item.series] = [];
        }
        seriesToProcesses[item.series].push({
            process: item.process,
            step: item.step
        });
    });
    
    // 分组产品数据，按型号统计
    const productsByModel = {};
    products.forEach(product => {
        const model = product.产品型号;
        if (!model) return; // 跳过没有型号的产品
        
        if (!productsByModel[model]) {
            productsByModel[model] = [];
        }
        productsByModel[model].push(product);
    });
    
    // 生成统计结果
    const statistics = [];
    
    for (const model in productsByModel) {
        const products = productsByModel[model];
        const series = modelToSeries[model];
        
        if (!series || !seriesToProcesses[series]) {
            // 跳过没有对应工艺分类或工艺流程的型号
            statistics.push({
                model,
                series: series || '未知',
                processes: '未定义',
                completedCount: 0,
                totalCount: products.length,
                completionRate: '0%'
            });
            continue;
        }
        
        // 获取工艺流程
        const processes = seriesToProcesses[series];
        // 按工艺流程步骤排序
        processes.sort((a, b) => a.step - b.step);
        
        // 计算完成最后一步的产品数量
        let completedCount = 0;
        
        products.forEach(product => {
            // 根据检验时间判断是否完成各工艺步骤
            // 这里简化处理，如果有成品检验时间，视为完成所有工艺
            if (product.成品检验时间) {
                completedCount++;
            }
        });
        
        // 计算完成率
        const completionRate = products.length > 0 
            ? ((completedCount / products.length) * 100).toFixed(2) + '%' 
            : '0%';
        
        // 添加到统计结果
        statistics.push({
            model,
            series,
            processes: processes.map(p => p.process).join(' -> '),
            completedCount,
            totalCount: products.length,
            completionRate
        });
    }
    
    // 清空现有表格内容
    statisticsTable.innerHTML = '';
    
    // 生成表格行
    statistics.forEach(stat => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${stat.model}</td>
            <td>${stat.series}</td>
            <td>${stat.processes}</td>
            <td>${stat.completedCount}/${stat.totalCount}</td>
            <td>${stat.completionRate}</td>
        `;
        
        statisticsTable.appendChild(row);
    });
}

// 设置每分钟轮询
const POLL_INTERVAL = 60 * 1000; // 60秒
setInterval(fetchProductionData, POLL_INTERVAL);

// 页面加载时立即获取数据
document.addEventListener('DOMContentLoaded', fetchProductionData);