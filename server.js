const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');
const router = express.Router();
const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = require('./firebaseConfig.json');// Caminho para o arquivo JSON
const stream = require('stream'); // Importa o módulo 'stream' para criar um stream legível
const axios = require('axios');
const Midia = require('./models/Midia');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const mongoURI = process.env.MONGO_URI;

// Inicializa o Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'gs://projetopi4-d8195.appspot.com', // Certifique-se de adicionar a URL do bucket no .env
});

const bucket = admin.storage().bucket();

// Configuração do multer para armazenar os arquivos em memória
const fileUpload = multer({ storage: multer.memoryStorage() });

// Middleware CORS para permitir qualquer origem
const corsOptions = {
  origin: '*', // Permite qualquer origem
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Métodos permitidos
  allowedHeaders: ['Content-Type', 'Authorization'], // Cabeçalhos permitidos
  credentials: true, // Permite cookies ou credenciais na requisição (se necessário)
};

app.use(cors(corsOptions));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Conectar ao MongoDB
mongoose.connect(mongoURI)
  .then(() => console.log('Conectado ao MongoDB'))
  .catch((err) => console.error('Erro ao conectar ao MongoDB:', err));


// Definir o schema de Playlist
const playlistSchema = new mongoose.Schema({
  name: String,
  midias: [ // Mudando de media para midias
    {
      name: String,
      url: String
    }
  ]
});

// Modelo para os itens do cardápio
const ItemCardapioSchema = new mongoose.Schema({
  nome: String,
  descricao: String,
  preco: Number,
  imagem: String,
});

const ItemCardapio = mongoose.model('ItemCardapio', ItemCardapioSchema);

// Rota para obter os itens do cardápio
app.get('/api/cardapio', async (req, res) => {
  try {
    const itens = await ItemCardapio.find();
    res.json(itens);
  } catch (err) {
    res.status(500).send('Erro ao buscar o cardápio');
  }
});

// Rota para atualizar o preço de um item
app.put('/api/cardapio/:id', async (req, res) => {
  const { id } = req.params;
  const { preco } = req.body;

  try {
    const item = await ItemCardapio.findByIdAndUpdate(
      id,
      { preco },
      { new: true }
    );
    res.json(item);
  } catch (err) {
    res.status(500).send('Erro ao atualizar o preço');
  }
});

// Adicionando itens de exemplo (uma única vez)
app.get('/api/inicializar', async (req, res) => {
  try {
    const itens = [
      {
        nome: 'Hambúrguer Clássico',
        descricao: 'Pão artesanal, carne 150g, queijo, alface e tomate.',
        preco: 25.0,
        imagem: 'hamburguer-classico.jpg',
      },
      {
        nome: 'Hambúrguer BBQ',
        descricao: 'Pão brioche, carne 180g, cheddar, bacon crocante e molho barbecue.',
        preco: 32.0,
        imagem: 'hamburguer-bbq.jpg',
      },
      {
        nome: 'Hambúrguer Vegano',
        descricao: 'Pão integral, hambúrguer de grão-de-bico, rúcula e molho especial.',
        preco: 28.0,
        imagem: 'hamburguer-vegano.jpg',
      },
    ];

    await ItemCardapio.insertMany(itens);
    res.send('Cardápio inicializado com sucesso!');
  } catch (err) {
    res.status(500).send('Erro ao inicializar o cardápio');
  }
});

// Rota para adicionar um item
app.post('/api/cardapio', async (req, res) => {
  try {
    const { nome, descricao, preco, imagem } = req.body;

    if (!nome || !descricao || !preco || !imagem) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios!' });
    }

    const novoItem = new ItemCardapio({ nome, descricao, preco, imagem });
    await novoItem.save();
    res.status(201).json(novoItem);
  } catch (error) {
    console.error('Erro ao adicionar item:', error);
    res.status(500).json({ message: 'Erro ao adicionar item.' });
  }
});

// Rota para remover um item
app.delete('/api/cardapio/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const itemRemovido = await ItemCardapio.findByIdAndDelete(id);

    if (!itemRemovido) {
      return res.status(404).json({ message: 'Item não encontrado.' });
    }

    res.json({ message: 'Item removido com sucesso.' });
  } catch (error) {
    console.error('Erro ao remover item:', error);
    res.status(500).json({ message: 'Erro ao remover item.' });
  }
});

// Criar o modelo de Playlist
const Playlist = mongoose.model('Playlist', playlistSchema);

// Rota de teste
app.get('/', (req, res) => {
  res.send('API do sistema de Mídia Indoor');
});

// Rota para buscar todas as playlists
app.get('/playlists', async (req, res) => {
  try {
    const playlists = await Playlist.find(); // Puxa as playlists do banco de dados
    console.log('Playlists encontradas:', playlists); // Log das playlists
    res.status(200).json(playlists); // Retorna as playlists como resposta
  } catch (error) {
    console.error('Erro ao buscar playlists:', error);
    res.status(500).json({ message: 'Erro ao buscar playlists' });
  }
});

app.post('/playlists', async (req, res) => {
  const { name } = req.body;

  try {
    const newPlaylist = new Playlist({ name }); // Aqui você só precisa passar o nome
    await newPlaylist.save();
    res.status(201).json({ message: 'Playlist criada com sucesso', playlist: newPlaylist });
  } catch (error) {
    console.error('Erro ao criar playlist:', error);
    res.status(500).json({ message: 'Erro ao criar playlist' });
  }
});


// Rota para excluir uma playlist
app.delete('/playlists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Playlist.findByIdAndDelete(id);
    res.status(200).json({ message: 'Playlist excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir playlist:', error);
    res.status(500).json({ message: 'Erro ao excluir playlist' });
  }
});

// Configuração do multer para upload de mídia
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Pasta onde os arquivos serão armazenados
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Nomeia o arquivo com timestamp
  }
});

const upload = multer({ storage: storage });

// Rota para upload de mídia para uma playlist
app.post('/playlists/:id/midias', upload.array('midias'), async (req, res) => {
  try {
    const { id } = req.params;
    const playlist = await Playlist.findById(id);

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist não encontrada' });
    }

    // Adiciona os nomes das mídias ao array de midias da playlist
    const midiasItems = req.files.map((file) => ({
      name: file.originalname,
      url: `/uploads/${file.filename}`,
    }));

    // Concatena as novas mídias à playlist
    playlist.midias = playlist.midias ? playlist.midias.concat(midiasItems) : midiasItems;
    await playlist.save();

    res.status(200).json({ midias: playlist.midias });
  } catch (error) {
    console.error('Erro ao fazer upload de mídia:', error); // Log detalhado
    res.status(500).json({ message: 'Erro ao fazer upload de mídia', error: error.message }); // Incluindo a mensagem de erro
  }
});

// Rota para excluir uma mídia de uma playlist
app.delete('/playlists/:playlistId/midias/:midiaId', async (req, res) => {
  const { playlistId, midiaId } = req.params;

  try {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).send('Playlist não encontrada');
    }

    // Remove a mídia da lista de mídias da playlist
    playlist.midias = playlist.midias.filter((midia) => midia._id.toString() !== midiaId);
    await playlist.save();

    res.status(200).json({ midias: playlist.midias });
  } catch (error) {
    console.error('Erro ao excluir mídia:', error);
    res.status(500).send('Erro ao excluir mídia');
  }
});

const monitorSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Nome do monitor
  playlist: { // Referência à playlist associada
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Playlist' // Refere-se ao esquema de Playlist
  }
});

module.exports = mongoose.model('Monitor', monitorSchema);

const Monitor = mongoose.model('Monitor', monitorSchema);

// GET route para obter todos os monitores com as playlists populadas
app.get('/monitores', async (req, res) => {
  try {
    // Busca todos os monitores e popula a referência da playlist
    const monitores = await Monitor.find().populate('playlist');

    res.status(200).json(monitores);
  } catch (error) {
    console.error('Erro ao buscar monitores:', error);
    res.status(500).json({ message: 'Erro ao buscar monitores' });
  }
});

// Rota para buscar o monitor pelo ID
app.get('/monitor/:id', async (req, res) => {
  const monitorId = req.params.id;

  try {
    const monitor = await Monitor.findById(monitorId).populate('playlist');
    if (!monitor) {
      return res.status(404).send('Monitor não encontrado');
    }
    res.json(monitor); // Retorna o monitor e sua playlist
  } catch (error) {
    res.status(500).send('Erro no servidor');
  }
});

app.post('/monitores', async (req, res) => {
  const { name } = req.body;

  try {
    const newMonitor = new Monitor({ name });
    await newMonitor.save();
    res.status(201).json(newMonitor);
  } catch (error) {
    console.error('Erro ao criar monitor:', error);
    res.status(500).json({ message: 'Erro ao criar monitor' });
  }
});

app.delete('/monitores/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Tenta encontrar e excluir o monitor pelo ID
    const deletedMonitor = await Monitor.findByIdAndDelete(id);

    // Se o monitor não for encontrado, retorna 404
    if (!deletedMonitor) {
      return res.status(404).json({ message: 'Monitor não encontrado' });
    }

    res.status(200).json({ message: 'Monitor excluído com sucesso', deletedMonitor });
  } catch (error) {
    console.error('Erro ao excluir monitor:', error);
    res.status(500).json({ message: 'Erro ao excluir monitor' });
  }
});

// Endpoint para associar uma playlist a um monitor
app.post('/monitores/:monitorId/playlists', async (req, res) => {
  const { monitorId } = req.params;
  const { playlistId } = req.body;

  // Validação dos dados recebidos
  if (!playlistId) {
    return res.status(400).json({ message: 'O campo playlistId é obrigatório.' });
  }

  try {
    // Encontrar o monitor pelo ID
    const monitor = await Monitor.findById(monitorId);
    if (!monitor) {
      return res.status(404).json({ message: 'Monitor não encontrado.' });
    }

    // Verificar se a playlist já está associada ao monitor
    if (monitor.playlists.includes(playlistId)) {
      return res.status(400).json({ message: 'A playlist já está associada a este monitor.' });
    }

    // Adicionar a playlist ao monitor
    monitor.playlists.push(playlistId);
    await monitor.save();

    // Log de sucesso
    console.log('Playlist associada com sucesso ao monitor:', monitor);

    // Retorno da resposta
    return res.status(200).json(monitor);
  } catch (error) {
    // Log do erro
    console.error('Erro ao associar playlist ao monitor:', error.message || error);

    // Retorno de erro
    return res.status(500).json({ message: 'Erro ao associar playlist', error: error.message });
  }
});

// Atualizar monitor com a playlist
app.put('/monitores/:monitorId/playlists', async (req, res) => {
  const { monitorId } = req.params;
  const { playlistId } = req.body;

  try {
    // Verificar se o monitor e a playlist existem
    const monitor = await Monitor.findById(monitorId);
    const playlist = await Playlist.findById(playlistId);

    if (!monitor || !playlist) {
      return res.status(404).json({ message: 'Monitor ou Playlist não encontrados' });
    }

    // Atualizar o monitor com o ID da playlist
    monitor.playlistId = playlistId;
    await monitor.save();

    res.json({ message: 'Monitor atualizado com sucesso!', monitor });
  } catch (error) {
    console.error('Erro ao atualizar monitor:', error);
    res.status(500).json({ message: 'Erro ao atualizar monitor', error });
  }
});


// PUT route para atualizar o monitor com uma playlist associada
app.put('/monitores/:id', async (req, res) => {
  try {
    const { playlistId } = req.body; // Recebe o playlistId do frontend

    // Encontra e atualiza o monitor com a nova playlist
    const updatedMonitor = await Monitor.findByIdAndUpdate(
      req.params.id,
      { playlist: playlistId },
      { new: true }
    );

    if (!updatedMonitor) {
      return res.status(404).json({ message: 'Monitor não encontrado' });
    }

    res.status(200).json(updatedMonitor);
  } catch (error) {
    console.error('Erro ao atualizar monitor:', error);
    res.status(500).json({ message: 'Erro ao atualizar monitor' });
  }
});

// Rota para criar monitor sem playlist associada
app.post('/monitores', async (req, res) => {
  try {
    const { name } = req.body;
    const monitor = new Monitor({ name });
    await monitor.save();
    res.status(201).json(monitor);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar monitor' });
  }
});

router.post('/monitores', async (req, res) => {
  try {
    const { name } = req.body;
    const newMonitor = new Monitor({ name });
    await newMonitor.save();
    res.status(201).json(newMonitor); // Retorna o monitor criado
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao criar monitor' });
  }
});

// Rota para associar uma playlist a um monitor
router.put('/monitores/:id', async (req, res) => {
  try {
    const monitorId = req.params.id;
    const { playlistId } = req.body;

    // Verifica se a playlist existe
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist não encontrada' });
    }

    // Atualiza o monitor com a playlist associada
    const updatedMonitor = await Monitor.findByIdAndUpdate(monitorId, { playlist: playlistId }, { new: true }).populate('playlist');

    res.json(updatedMonitor); // Retorna o monitor atualizado
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao atualizar monitor' });
  }
});

// Rota para buscar um monitor específico por ID
app.get('/monitores/:monitorId', async (req, res) => {
  const { monitorId } = req.params;
  try {
    const monitor = await Monitor.findById(monitorId).populate('playlist');
    if (!monitor) {
      return res.status(404).json({ message: 'Monitor não encontrado' });
    }
    res.status(200).json(monitor);
  } catch (error) {
    console.error('Erro ao buscar monitor:', error);
    res.status(500).json({ message: 'Erro ao buscar monitor' });
  }
});

app.post('/midias', fileUpload.single('file'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
    }

    const fileBuffer = file.buffer; // Obtém o buffer do arquivo enviado

    // Envia o arquivo para o Firebase Storage
    const fileName = `${Date.now()}-${file.originalname}`; // Nome do arquivo
    const fileFirebase = bucket.file(`imagens/${fileName}`);

    // Faz o upload do buffer diretamente para o Firebase Storage
    const fileStream = fileFirebase.createWriteStream({
      metadata: {
        contentType: file.mimetype, // Tipo do arquivo
      },
    });

    // Escreve o buffer no stream do Firebase
    fileStream.end(fileBuffer);

    // Aguarda o upload terminar e cria a URL pública
    fileStream.on('finish', async () => {
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/imagens%2F${encodeURIComponent(fileName)}?alt=media`;

      // Salva a URL no MongoDB
      const midia = new Midia({
        name: file.originalname,
        url: publicUrl,
        type: file.mimetype.includes('image')
          ? 'image'
          : file.mimetype.includes('video')
            ? 'video'
            : 'text',
      });

      await midia.save();

      res.status(201).json(midia);
    });

    // Tratar erros durante o upload
    fileStream.on('error', (error) => {
      console.error('Erro ao fazer upload para o Firebase:', error);
      res.status(500).json({ message: 'Erro ao fazer upload para o Firebase.', error: error.message });
    });
  } catch (error) {
    console.error('Erro ao processar o arquivo:', error);
    res.status(500).json({ message: 'Erro ao fazer upload da mídia.', error: error.message });
  }
});

// Exemplo em Express
app.post('/playlists/:playlistId/midias/:midiaId', async (req, res) => {
  const { playlistId, midiaId } = req.params;

  try {
    // Aqui você pode buscar a mídia pelo ID
    const midia = await Midia.findById(midiaId);
    if (!midia) {
      return res.status(404).send('Mídia não encontrada');
    }

    // Aqui você deve associar a mídia à playlist, dependendo de como você armazena isso
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).send('Playlist não encontrada');
    }

    // Associando a mídia à playlist
    playlist.midias.push(midia); // ou playlist.midias.push({ _id: midia._id, name: midia.name, url: midia.url }); se necessário
    await playlist.save();

    // Retornando a mídia com os detalhes
    res.status(200).json(midia);
  } catch (error) {
    console.error('Erro ao associar mídia à playlist:', error);
    res.status(500).send('Erro ao associar mídia à playlist');
  }
});

// Rota para buscar mídias
app.get('/midias', async (req, res) => {
  try {
    const midias = await Midia.find();
    if (midias.length === 0) {
      return res.status(404).json({ message: 'Nenhuma mídia encontrada' });
    }
    res.status(200).json(midias);
  } catch (error) {
    console.error('Erro ao buscar mídias:', error);
    res.status(500).json({ message: 'Erro ao buscar mídias', error: error.message });
  }
});

app.delete('/midias/:id', async (req, res) => {
  try {
    const midiaId = req.params.id;

    // Busca a mídia pelo ID no MongoDB
    const midia = await Midia.findById(midiaId);
    if (!midia) {
      return res.status(404).json({ message: 'Mídia não encontrada no banco de dados.' });
    }

    // Obtém o nome do arquivo a partir da URL da mídia
    const fileUrl = midia.url;
    const bucketName = bucket.name;

    // Remova qualquer '?' no final da URL antes de extrair o nome do arquivo
    const cleanUrl = fileUrl.split('?')[0];

    // Use expressão regular para extrair o nome do arquivo
    const regex = new RegExp(`https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/imagens%2F(.+)`);
    const match = cleanUrl.match(regex);

    if (!match || match.length < 2) {
      return res.status(400).json({ message: 'URL do arquivo inválida. Não foi possível extrair o nome do arquivo.' });
    }

    const fileName = decodeURIComponent(match[1]); // Decodifica o nome do arquivo

    // Referência ao arquivo no Firebase Storage
    const fileFirebase = bucket.file(`imagens/${fileName}`);

    // Tenta deletar o arquivo do Firebase Storage
    await fileFirebase.delete();

    // Remove o registro do banco de dados
    await Midia.findByIdAndDelete(midiaId);

    res.status(200).json({ message: 'Mídia removida com sucesso!' });
  } catch (error) {
    console.error('Erro ao remover a mídia:', error);
    res.status(500).json({ message: 'Erro ao remover a mídia.', error: error.message });
  }
});

app.put('/playlists/:id/midias', async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).send({ message: 'Playlist não encontrada.' });
    }

    playlist.midias = [...playlist.midias, ...req.body.midias];
    await playlist.save();

    res.status(200).send(playlist);
  } catch (error) {
    res.status(500).send({ message: 'Erro ao adicionar mídias à playlist.' });
  }
});

app.put('/playlists/:id/midias', async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).send({ message: 'Playlist não encontrada.' });
    }

    playlist.midias = [...playlist.midias, ...req.body.midias];
    await playlist.save();

    res.status(200).send(playlist);
  } catch (error) {
    res.status(500).send({ message: 'Erro ao adicionar mídias à playlist.' });
  }
});

router.post('/midias', upload.single('file'), async (req, res) => {
  try {
    // Arquivo enviado pelo multer
    const file = req.file;
    const filePath = file.path; // Caminho temporário do arquivo local

    // Crie uma referência para o arquivo no Firebase Storage
    const firebaseFile = bucket.file(file.filename);

    // Faça o upload do arquivo para o Firebase Storage
    await firebaseFile.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    // Crie uma URL do arquivo no Firebase Storage
    const firebaseUrl = `https://storage.googleapis.com/${bucket.name}/${firebaseFile.name}`;

    // Salve as informações no banco de dados (MongoDB)
    const midia = new Midia({
      name: file.filename,
      url: firebaseUrl,
      size: file.size,
      mimetype: file.mimetype,
    });

    await midia.save();
    res.status(200).json({ message: 'Mídia enviada com sucesso!' });
  } catch (error) {
    console.error('Erro ao enviar a mídia:', error);
    res.status(500).json({ message: 'Erro ao enviar a mídia' });
  }
});

module.exports = router;

app.get('/proxy', async (req, res) => {
  const fileUrl = req.query.url;  // Recebe a URL do arquivo como parâmetro
  try {
    const response = await axios.get(fileUrl, { responseType: 'stream' });
    res.setHeader('Content-Type', response.headers['content-type']);
    response.data.pipe(res);  // Envia o arquivo para o cliente
  } catch (error) {
    res.status(500).send('Erro ao acessar o arquivo');
  }
});

// Rota para obter as URLs das mídias de uma playlist
app.get("/playlist/:monitorId", async (req, res) => {
  try {
    const monitorId = req.params.monitorId;

    // Encontre o monitor no banco de dados
    const monitor = await Monitor.findById(monitorId).populate("playlist");

    if (!monitor) {
      return res.status(404).json({ error: "Monitor não encontrado" });
    }

    const mediaUrls = monitor.playlist.midias.map(media => media.url);

    // Retorna as URLs das mídias para o frontend
    res.json(mediaUrls);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar mídias" });
  }
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});