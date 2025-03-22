import React, { useState } from 'react';
import { 
  Container, 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper,
  CircularProgress,
  Grid,
  Card,
  CardMedia,
  CardActions,
  IconButton,
  Tooltip,
  Fade,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';

// 简单的重试函数
async function fetchWithRetry(url, options, maxRetries = 3) {
  const timeout = 30000; // 30秒超时
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        mode: 'cors',
        signal: controller.signal,
        headers: {
          ...options.headers,
          'Accept': 'application/json',
          'Connection': 'keep-alive'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    } catch (error) {
      console.error(`请求失败 (${i + 1}/${maxRetries}):`, error);
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // 使用递增的等待时间，但不要等待太久
      await new Promise(resolve => setTimeout(resolve, Math.min(500 * (i + 1), 2000)));
    }
  }
}

function App() {
  const [prompt, setPrompt] = useState('');
  const [generatedImages, setGeneratedImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  const generateMemes = async () => {
    try {
      if (!process.env.REACT_APP_HUGGINGFACE_API_KEY || 
          process.env.REACT_APP_HUGGINGFACE_API_KEY === 'hf_xxx') {
        setError('请先设置 HuggingFace API Key！\n1. 访问 https://huggingface.co/settings/tokens 获取 API Key\n2. 将 API Key 填入 .env 文件中');
        return;
      }

      setLoading(true);
      setError('');
      setProgress(0);
      
      const englishPrompt = prompt.match(/^[a-zA-Z\s]+$/) ? 
        prompt : 
        prompt + " (meme style, funny, humorous, high quality)";

      const totalImages = 4;
      const images = [];
      
      // 使用 Promise.race 并行处理请求
      for (let i = 0; i < totalImages; i++) {
        try {
          const response = await Promise.race([
            fetchWithRetry(
              "https://api-inference.huggingface.co/models/CompVis/stable-diffusion-v1-4",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${process.env.REACT_APP_HUGGINGFACE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  inputs: englishPrompt,
                  parameters: {
                    num_inference_steps: 30,
                    guidance_scale: 7.5,
                    width: 512,
                    height: 512
                  }
                })
              }
            ),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('请求超时')), 60000)
            )
          ]);

          const buffer = await response.arrayBuffer();
          const base64Image = btoa(
            new Uint8Array(buffer)
              .reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          
          images.push(base64Image);
          setProgress((i + 1) * 25); // 更新进度
          
          // 立即显示已生成的图片
          setGeneratedImages([...images]);
        } catch (err) {
          console.error('单张图片生成失败:', err);
          throw err;
        }
      }

      setError('');
    } catch (err) {
      console.error('错误详情:', err);
      
      if (err.message.includes('Failed to fetch')) {
        setError('网络连接失败。请按以下步骤检查：\n' +
          '1. 确保 Clash 已启动并正常运行\n' +
          '2. 在 Clash 设置中确认端口为 7890\n' +
          '3. 打开 Windows 设置 > 网络和 Internet > 代理\n' +
          '4. 确保"使用代理服务器"已开启\n' +
          '5. 地址设为：127.0.0.1，端口：7890\n' +
          '6. 如果还不行，请尝试重启 Clash');
      } else if (err.message.includes('status: 503')) {
        setError('模型正在加载中，请等待1-2分钟后重试');
      } else if (err.message.includes('status: 429')) {
        setError('请求过于频繁，请等待一会儿再试');
      } else if (err.message.includes('status: 401')) {
        setError('API Key 无效！请检查 API Key 是否正确设置');
      } else if (err.message === '请求超时') {
        setError('请求超时，请重试。如果频繁超时，请检查网络连接或尝试更换节点');
      } else {
        setError('生成图片时出错：' + err.message);
      }
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const downloadImage = (base64Image, index) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64Image}`;
    link.download = `meme_${index + 1}.png`;
    link.click();
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(120deg, #f6d365 0%, #fda085 100%)',
      py: 4
    }}>
      <Container maxWidth="lg">
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Typography 
            variant="h2" 
            component="h1" 
            gutterBottom 
            sx={{
              fontWeight: 'bold',
              color: '#fff',
              textShadow: '2px 2px 4px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2
            }}
          >
            <EmojiEmotionsIcon sx={{ fontSize: 45 }} />
            AI 表情包生成器
          </Typography>
        </Box>
        
        <Paper 
          elevation={3} 
          sx={{ 
            p: 4, 
            mb: 4, 
            borderRadius: 2,
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="描述你想要的表情包"
                variant="outlined"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                multiline
                rows={3}
                helperText="提示：建议使用英文描述，例如：a cute dog smiling, cartoon style"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={generateMemes}
                disabled={loading || !prompt}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #FF8E53 30%, #FE6B8B 90%)',
                  }
                }}
                startIcon={loading ? <CircularProgress size={24} color="inherit" /> : <AutorenewIcon />}
              >
                {loading ? `生成中... ${progress}%` : '一键生成4张表情包'}
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {error && (
          <Fade in={true}>
            <Paper 
              elevation={3} 
              sx={{ 
                p: 2, 
                mb: 4, 
                bgcolor: '#fff3f3',
                borderRadius: 2
              }}
            >
              <Typography color="error" align="center" gutterBottom>
                {error}
              </Typography>
              {error.includes('模型正在加载') && (
                <Typography variant="body2" align="center" color="textSecondary">
                  首次使用时模型需要加载，可能需要等待1-2分钟
                </Typography>
              )}
            </Paper>
          </Fade>
        )}

        {generatedImages.length > 0 && (
          <Grid container spacing={3}>
            {generatedImages.map((image, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Fade in={true} timeout={500 + index * 200}>
                  <Card 
                    elevation={3}
                    sx={{
                      borderRadius: 2,
                      transition: 'transform 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)'
                      }
                    }}
                  >
                    <CardMedia
                      component="img"
                      image={`data:image/png;base64,${image}`}
                      alt={`Generated meme ${index + 1}`}
                      sx={{
                        aspectRatio: '1',
                        objectFit: 'cover'
                      }}
                    />
                    <CardActions sx={{ justifyContent: 'flex-end', p: 1 }}>
                      <Tooltip title="下载图片">
                        <IconButton 
                          onClick={() => downloadImage(image, index)}
                          size="small"
                          color="primary"
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Fade>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
}

export default App;