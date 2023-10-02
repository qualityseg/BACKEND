require('dotenv').config();
console.log('DB Host:', process.env.DB_HOST);
console.log('DB User:', process.env.DB_USER);
console.log('DB Password:', process.env.DB_PASSWORD);
console.log('DB Name:', process.env.DB_NAME);

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const jwtSecret = 'suus02201998##';
const WebSocket = require('ws');

const app = express();

const pool = mysql.createPool({
  host: '129.148.55.118',
  user: 'QualityAdmin',
  password: 'Seg@1977',
  database: 'Psico-qslib',
});

app.use(cors({
  origin: ['http://localhost:3000', 'https://smoggy-pike-jumper.cyclic.app', 'https://psico-painel.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));


app.use(express.json());

app.get('/checkAvaliacao', async (req, res) => {
  const { cpf, instituicaoNome } = req.query;

  console.log("Rota CheckAvaliacao acionada. CPF:", cpf, ", Instituição:", instituicaoNome);  // Log para debug
  
  try {
    const [rows] = await pool.execute(
      'SELECT avaliacao_realizada FROM avaliacoes_realizadas WHERE cpf = ? AND instituicaoNome = ?',
      [cpf, instituicaoNome]
    );

    if (rows.length > 0) {
      // Se a avaliação foi realizada, atualize a data_avaliacao
      if (rows[0].avaliacao_realizada === 1) {
        await pool.execute(
          'UPDATE avaliacoes_realizadas SET data_avaliacao = NOW() WHERE cpf = ? AND instituicaoNome = ?',
          [cpf, instituicaoNome]
        );
      }
      res.status(200).json({ avaliacaoRealizada: rows[0].avaliacao_realizada });
    } else {
      res.status(404).send('Not Found');
    }
  } catch (error) {
    console.error('Database query failed:', error);  // Log para debug
    res.status(500).send('Internal Server Error');
  }
});


app.get('/api/evaluations/count', async (req, res) => {
  const instituicaoNome = req.query.instituicaoNome;
  
  try {
    // Consulta para contar todas as avaliações
    const [totalEvaluations] = await pool.execute('SELECT COUNT(*) as total FROM avaliacoes_realizadas WHERE instituicaoNome = ? AND avaliacao_realizada = 1', [instituicaoNome]);

    // Consulta para contar as avaliações feitas hoje usando a nova coluna data_avaliacao
    const [evaluationsToday] = await pool.execute('SELECT COUNT(*) as today FROM avaliacoes_realizadas WHERE instituicaoNome = ? AND avaliacao_realizada = 1 AND DATE(data_avaliacao) = CURDATE()', [instituicaoNome]);

    res.json({ total: totalEvaluations[0].total, today: evaluationsToday[0].today });
  } catch (error) {
    console.error("Erro ao executar consulta SQL:", error);
    res.status(500).json({ message: 'Erro ao recuperar contagens de avaliações' });
  }
});



app.post('/register', async (req, res) => {
  const {
    NomeCompleto,
    Email,
    Data_de_Nascimento,
    Genero,
    Telefone,
    Telefone2,
    CPF,
    CNPJ,
    Matricula,
    Observacoes,
    Endereco,
    Numero,
    Complemento,
    Bairro,
    Cidade,
    Estado,
    Pais,
    CEP,
    Unidade,
    Setor,
    Cargo,
    Instituicao,
    Acesso,
  } = req.body;

  try {
    const connection = await pool.getConnection();
    
    // Check if a user with the same email already exists
    const [existingUsers] = await connection.query('SELECT * FROM cadastro_clientes WHERE Email = ?', [Email]);
    if (existingUsers.length > 0) {
      return res.send({ success: false, message: 'Usuario (Email de acesso) já existente na sua Instituição.' });
    }

    const query =
      'INSERT INTO cadastro_clientes (NomeCompleto, Email, Data_de_Nascimento, Genero, Telefone, Telefone2, CPF, CNPJ, Matricula, Observacoes, Endereco, Numero, Complemento, Bairro, Cidade, Estado, Pais, CEP, Unidade, Setor, Cargo, Instituicao, instituicaoNome, Acesso) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const values = [
      NomeCompleto,
      Email,
      Data_de_Nascimento,
      Genero,
      Telefone,
      Telefone2,
      CPF,
      CNPJ,
      Matricula,
      Observacoes,
      Endereco,
      Numero,
      Complemento,
      Bairro,
      Cidade,
      Estado,
      Pais,
      CEP,
      Unidade,
      Setor,
      Cargo,
      Instituicao,
      Instituicao,
      Acesso,
    ];
    await connection.query(query, values);
    return res.send({ success: true, message: 'Usuário registrado com sucesso.' });
    
    } catch (err) {
        console.log(err);
        return res.send({ success: false, message: err.message });
    } finally {
        if (connection) connection.release();
    }
});





app.post('/login', async (req, res) => {
  const { identificador, senha } = req.body;

  const query = 'SELECT * FROM Usuarios WHERE identificador = ?';

  try {
    const connection = await pool.getConnection();
    const [results] = await connection.query(query, [identificador]);
    
    if (results.length === 0) {
      console.log('Nenhum usuário encontrado com o identificador fornecido');
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = results[0];

    if (senha !== user.senha) {
      console.log('Senha fornecida não corresponde à senha do usuário no banco de dados');
      return res.status(401).json({ success: false, message: 'Wrong password' });
    }

    const token = jwt.sign({ id: user.id, role: user.acesso, instituicaoNome: user.instituicaoNome }, jwtSecret, { expiresIn: '1h' });

    if (!token) {
      console.log('Falha ao criar o token JWT');
      return res.status(500).json({ success: false, message: 'Failed to create token' });
    }

    // Inclua o valor de 'instituicaoId' na resposta
  res.json({ success: true, username: user.identificador, role: user.acesso, token, instituicaoNome: user.instituicaoNome }); // Inclui o nome da instituição na resposta
  } catch (err) {
    console.log('Erro na consulta do banco de dados:', err);
    return res.status(500).json({ success: false, message: 'Database query error' });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/instituicoes', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    // Iniciar transação
    await connection.beginTransaction();

    // Desestruturação de dados do corpo da requisição
    const {
      nome, cnpj, inscricaoEstadual, razaoSocial, logradouro, numero,
      complemento, bairro, cidade, estado, pais, cep,
      contatos, unidades, setores, cargos, usuarios
    } = req.body;

    // Verificar se os campos obrigatórios estão presentes
    if (!nome || !cnpj) {
      return res.status(400).send('Nome da instituição e CNPJ são campos obrigatórios.');
    }

    // Verificar se uma instituição com o mesmo CNPJ já existe
    const [existingInstitutions] = await connection.query('SELECT * FROM Instituicoes WHERE cnpj = ?', [cnpj]);
    if (existingInstitutions.length > 0) {
      return res.status(400).send('Erro ao cadastrar Instituição, já existe uma instituição com esse CNPJ');
    }

    // Inserir dados na tabela Instituicoes
    const [instituicaoResult] = await connection.query(
      'INSERT INTO Instituicoes (instituicao, cnpj, inscricaoEstadual, razaoSocial, logradouro, numero, complemento, bairro, cidade, estado, pais, cep) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [nome, cnpj, inscricaoEstadual, razaoSocial, logradouro, numero, complemento, bairro, cidade, estado, pais, cep]
    );

    const instituicaoId = instituicaoResult.insertId;
    const instituicaoNome = nome; // Nome da instituição

    // Inserir dados na tabela Contatos
    for (const contato of contatos) {
      await connection.query(
        'INSERT INTO Contatos (instituicaoId, categoria, categoriaEspecifica, nomeCompleto, telefone, instituicaoNome) VALUES (?, ?, ?, ?, ?, ?)',
        [instituicaoId, contato.categoria, contato.categoriaEspecifica, contato.nomeCompleto, contato.telefone, instituicaoNome]
      );
    }

    // Inserir dados na tabela Unidades
    for (const unidade of unidades) {
      await connection.query('INSERT INTO Unidades (instituicaoId, instituicaoNome, unidade) VALUES (?, ?, ?)', [instituicaoId, instituicaoNome, unidade.unidade]);
    }

    // Inserir dados na tabela Setores
    for (const setor of setores) {
      await connection.query('INSERT INTO Setores (instituicaoId, instituicaoNome, setor) VALUES (?, ?, ?)', [instituicaoId, instituicaoNome, setor.setor]);
    }

    // Inserir dados na tabela Cargos
    for (const cargo of cargos) {
      await connection.query('INSERT INTO Cargos (instituicaoId, instituicaoNome, Cargo) VALUES (?, ?, ?)', [instituicaoId, instituicaoNome, cargo.cargo]);
    }

    // Inserir dados na tabela Usuarios
    for (const usuario of usuarios) {
      await connection.query('INSERT INTO Usuarios (instituicaoId, instituicaoNome, nome, identificador, senha, acesso) VALUES (?, ?, ?, ?, ?, ?)', [
        instituicaoId,
        instituicaoNome,
        usuario.nome,
        usuario.identificador,
        usuario.senha,
        'Administrador', // Acesso padrão para Administrador
      ]);
    }

    // Confirmação da transação
    await connection.commit();
    res.status(201).send('Instituição registrada com sucesso!');
  } catch (error) {
    // Desfazer a transação
    await connection.rollback();
    console.error(error);
    res.status(500).send('Erro ao registrar a instituição');
  } finally {
    connection.release();
  }
});


app.put('/instituicoes/:nome', async (req, res) => {
  const connection = await pool.getConnection();
  const instituicaoNome = req.params.id;

  const {
    nome, cnpj, inscricaoEstadual, razaoSocial, logradouro, numero, complemento,
    bairro, cidade, estado, pais, cep, contatos, unidades, setores, cargos, usuarios,
  } = req.body;

  try {
    // Atualizar os detalhes da instituição na tabela Instituicoes
    await connection.query(
      'UPDATE Instituicoes SET nome = ?, cnpj = ?, inscricaoEstadual = ?, razaoSocial = ?, logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, estado = ?, pais = ?, cep = ? WHERE id = ?',
      [nome, cnpj, inscricaoEstadual, razaoSocial, logradouro, numero, complemento, bairro, cidade, estado, pais, cep, instituicaoId]
    );

    // Atualizar tabela Contatos
    for (const contato of contatos) {
      await connection.query(
        'UPDATE Contatos SET categoria = ?, categoriaEspecifica = ?, nomeCompleto = ?, telefone = ?, instituicaoNome = ? WHERE instituicaoId = ?',
        [contato.categoria, contato.categoriaEspecifica, contato.nomeCompleto, contato.telefone, nome, instituicaoId]
      );
    }

    // Atualizar tabela Unidades
    for (const unidade of unidades) {
      await connection.query(
        'UPDATE Unidades SET unidade = ?, instituicaoNome = ? WHERE instituicaoId = ?',
        [unidade.unidade, nome, instituicaoId]
      );
    }

    // Atualizar tabela Setores
    for (const setor of setores) {
      await connection.query(
        'UPDATE Setores SET setor = ?, instituicaoNome = ? WHERE instituicaoId = ?',
        [setor.setor, nome, instituicaoId]
      );
    }

    // Atualizar tabela Cargos
    for (const cargo of cargos) {
      await connection.query(
        'UPDATE Cargos SET cargo = ?, instituicaoNome = ? WHERE instituicaoId = ?',
        [cargo.cargo, nome, instituicaoId]
      );
    }

    // Atualizar tabela Usuarios
    for (const usuario of usuarios) {
      await connection.query(
        'UPDATE Usuarios SET nome = ?, identificador = ?, senha = ?, acesso = ?, instituicaoNome = ? WHERE instituicaoId = ?',
        [usuario.nome, usuario.identificador, usuario.senha, usuario.acesso, nome, instituicaoId]
      );
    }

    res.status(200).send('Instituição atualizada com sucesso!');
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao atualizar a instituição');
  } finally {
    connection.release();
  }
});


app.delete('/instituicoes/:id', async (req, res) => {
  console.log('Objeto completo de parâmetros:', req.params); // Log dos parâmetros

  // Assumindo que o ID é extraído diretamente dos parâmetros (ajuste conforme necessário)
  const instituicaoId = req.params.id;

  console.log('ID da instituição:', instituicaoId); // Log do ID

  const connection = await pool.getConnection();

  try {
    // Iniciar transação
    await connection.beginTransaction();

    // Lista de tabelas relacionadas
    const relatedTables = ['Contatos', 'Unidades', 'Setores', 'Cargos', 'Usuarios'];
    
    // Excluir dados relacionados em outras tabelas usando instituicaoId
    for (const table of relatedTables) {
      const [result] = await connection.query(`DELETE FROM ${table} WHERE instituicaoId = ?`, [instituicaoId]);
      console.log(`Registros excluídos da tabela ${table}:`, result.affectedRows);
      if (result.affectedRows === 0) {
        console.warn(`Nenhum registro encontrado para exclusão na tabela ${table} para instituicaoId: ${instituicaoId}`);
      }
    }

    // Excluir a instituição da tabela Instituicoes usando o ID
    const [deleteInstituicaoResult] = await connection.query('DELETE FROM Instituicoes WHERE id = ?', [instituicaoId]);
    if (deleteInstituicaoResult.affectedRows === 0) {
      throw new Error(`Instituição com ID ${instituicaoId} não encontrada`);
    }

    // Confirmar transação
    await connection.commit();
    res.status(200).send('Instituição excluída com sucesso!');
  } catch (error) {
    // Reverter transação em caso de erro
    await connection.rollback();
    console.error(error);
    res.status(500).send('Erro ao excluir a instituição');
  } finally {
    connection.release();
  }
});








app.get('/instituicoes', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const [instituicoes] = await connection.query('SELECT * FROM Instituicoes');
    res.status(200).json(instituicoes);
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao buscar as instituições');
  } finally {
    connection.release();
  }
});

app.get('/instituicao-detalhes', async (req, res) => {
  const connection = await pool.getConnection();
  const instituicaoId = req.query.instituicaoId;

  try {
    const [instituicao] = await connection.query(
      'SELECT instituicao, cnpj, inscricaoEstadual, razaoSocial, logradouro, numero, complemento, bairro, cidade, estado, pais, cep FROM Instituicoes WHERE id = ?',
      [instituicaoId]
    );
    res.status(200).json(instituicao);
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao buscar detalhes da instituição');
  } finally {
    connection.release();
  }
});

app.get('/cargos', async (req, res) => {
  const connection = await pool.getConnection();
  const instituicaoId = req.query.instituicaoId;

  try {
    const [cargos] = await connection.query('SELECT * FROM Cargos WHERE instituicaoId = ?', [instituicaoId]);
    res.status(200).json(cargos);
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao buscar os cargos');
  } finally {
    connection.release();
  }
});

app.get('/contatos', async (req, res) => {
  const connection = await pool.getConnection();
  const instituicaoId = req.query.instituicaoId;

  try {
    const [contatos] = await connection.query('SELECT * FROM Contatos WHERE instituicaoId = ?', [instituicaoId]);
    res.status(200).json(contatos);
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao buscar os contatos');
  } finally {
    connection.release();
  }
});

app.get('/setores', async (req, res) => {
  const connection = await pool.getConnection();
  const instituicaoId = req.query.instituicaoId;

  try {
    const [setores] = await connection.query('SELECT * FROM Setores WHERE instituicaoId = ?', [instituicaoId]);
    res.status(200).json(setores);
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao buscar os setores');
  } finally {
    connection.release();
  }
});

app.get('/unidades', async (req, res) => {
  const connection = await pool.getConnection();
  const instituicaoId = req.query.instituicaoId;

  try {
    const [unidades] = await connection.query('SELECT * FROM Unidades WHERE instituicaoId = ?', [instituicaoId]);
    res.status(200).json(unidades);
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao buscar as unidades');
  } finally {
    connection.release();
  }
});

app.get('/usuarios', async (req, res) => {
  const connection = await pool.getConnection();
  const instituicaoNome = req.query.instituicaoNome;

  try {
    const query = instituicaoNome ?
      'SELECT * FROM cadastro_clientes WHERE instituicaoNome = ?' :
      'SELECT * FROM cadastro_clientes';
    const [usuarios] = await connection.query(query, [instituicaoNome]);
    res.status(200).json(usuarios);
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao buscar os usuários');
  } finally {
    connection.release();
  }
});


app.get('/usuarios_instituicao', async (req, res) => {
  const instituicaoId = req.query.instituicaoId; // Obter o ID da instituição da query

  try {
    // Execute a query para buscar usuários da tabela Usuarios que correspondem ao ID da instituição
    const [usuarios] = await pool.query('SELECT nome, identificador, senha, acesso FROM Usuarios WHERE instituicaoId = ?', [instituicaoId]);
    
    // Enviar os usuários como resposta JSON
    res.status(200).json(usuarios);
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao buscar usuários');
  }
});

app.post('/salvar-instituicao', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction(); // Iniciar a transação

    const { instituicoes, cargos, contatos, setores, unidades, usuarios } = req.body;

    // Validar os dados recebidos
    if (!instituicoes || instituicoes.length === 0) {
      throw new Error('Instituicoes é indefinido ou vazio.');
    }

    const instituicoesData = instituicoes[0];
    if (!instituicoesData.id) {
      throw new Error('ID da Instituição não fornecido.');
    }

    // Atualizar a tabela Instituicoes
    const instituicoesValues = Object.values(instituicoesData);
    const instituicoesQuery = `UPDATE Instituicoes SET instituicao = ?, cnpj = ?, inscricaoEstadual = ?, razaoSocial = ?, logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, estado = ?, pais = ?, cep = ? WHERE id = ?;`;
    await connection.execute(instituicoesQuery, instituicoesValues);

    // Atualizar outras tabelas (Cargos, Contatos, Setores, Unidades)
    const tables = { Cargos: cargos, Contatos: contatos, Setores: setores, Unidades: unidades };
    for (const [table, data] of Object.entries(tables)) {
      const field = table.slice(0, -1).toLowerCase();
      const query = `UPDATE ${table} SET ${field} = ? WHERE instituicaoId = ? AND id = ?;`;

      for (const item of data) {
        if (item.instituicaoId === undefined || item[field] === undefined || item.id === undefined) {
          console.error(`Um ou mais campos estão indefinidos para tabela ${table}:`, item);
          continue;
        }
        await connection.execute(query, [item[field], item.instituicaoId, item.id]);
      }
    }

    // Atualizar a tabela Usuarios
    const usuariosQuery = `UPDATE Usuarios SET nome = ?, identificador = ?, senha = ?, acesso = ? WHERE instituicaoId = ? AND id = ?;`;
    for (const item of usuarios) {
      const { nome, identificador, senha, acesso, instituicaoId, id } = item;
      if ([nome, identificador, senha, acesso, instituicaoId, id].includes(undefined)) {
        console.error('Um ou mais campos estão indefinidos:', item);
        continue;
      }
      await connection.execute(usuariosQuery, [nome, identificador, senha, acesso, instituicaoId, id]);
    }

    await connection.commit(); // Commit da transação
    res.status(200).json({ success: true });
  } catch (error) {
    await connection.rollback(); // Reverter a transação
    console.error('Erro ao salvar as alterações:', error);
    res.status(500).send('Erro ao salvar as alterações');
  } finally {
    connection.release(); // Liberar a conexão
  }
});


app.post('/webhook/zoho', async (req, res) => {
  const payload = req.body;
  console.log("Received payload:", payload);

  const { cpf } = payload;

  if (typeof cpf === 'undefined') {
    return res.status(400).send('Bad Request: CPF is undefined');
  }

  try {
    // Primeiro, buscar o nome e instituicaoNome com base no CPF na tabela cadastro_clientes
    const [clientes] = await pool.execute('SELECT nome, instituicaoNome FROM cadastro_clientes WHERE cpf = ?', [cpf]);
    
    if (clientes.length === 0) {
      return res.status(404).send('Cliente não encontrado');
    }

    const { nome, instituicaoNome } = clientes[0];

    // Agora, atualizar a tabela avaliacoes_realizadas
    const [rows] = await pool.execute('INSERT INTO avaliacoes_realizadas (cpf, instituicaoNome, nome, avaliacao_realizada) VALUES (?, ?, ?, 1)', [cpf, instituicaoNome, nome]);


    if (rows.affectedRows > 0) {
      res.status(200).send('Webhook received and database updated');
    } else {
      res.status(500).send('Database update failed');
    }
  } catch (error) {
    console.error('Database update failed:', error);
    res.status(500).send('Internal Server Error');
  }
});



app.post('/register_usuario', async (req, res) => {
  const { usuario, nome, email, senha, unidade, setor, acesso } = req.body;

  try {
    // Criptografe a senha antes de armazenar no banco de dados
    const senhaHash = await bcrypt.hash(senha, 10);

    const query = 'INSERT INTO login_register (usuario, nome, email, senha, unidade, setor, acesso) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const values = [usuario, nome, email, senhaHash, unidade, setor, acesso];

    const connection = await pool.getConnection();
    const [result] = await connection.query(query, values);

    res.send({ success: true });
  } catch (err) {
    console.log(err);
    return res.send({ success: false, message: err.message });
  } finally {
    if (connection) connection.release();
  }
});

app.delete('/deleteAllUsers', async (req, res) => {
  const query = 'DELETE FROM login_register';
  
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(query);

    if (result.affectedRows > 0) {
      res.send({ success: true, message: `${result.affectedRows} usuário(s) foram excluídos.` });
    } else {
      res.send({ success: false, message: 'Não há usuários para excluir.' });
    }
  } catch (err) {
    console.log(err);
    return res.send({ success: false, message: 'Falha ao excluir usuários: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
});

// In server.js

app.post("/api/user/login", async (req, res) => {
  const { Email, senha } = req.body;

  // Verifique se os parâmetros estão definidos
  if (!Email || !senha) {
    console.log('Dados incompletos recebidos.');  // Log de diagnóstico
    return res.status(400).json({ success: false, message: 'Dados incompletos.' });
  }
  
  // Log de diagnóstico para imprimir os valores recebidos
  console.log(`Valores recebidos: Email = ${Email}, senha = ${senha}`);

  // Query para encontrar o usuário com o e-mail e a senha fornecidos
  const query = "SELECT * FROM cadastro_clientes WHERE Email = ? AND senha = ?";

  try {
    const [results] = await pool.execute(query, [Email, senha]);
    if (results.length > 0) {
      const user = results[0];

      // Gerar um token JWT (ou outro mecanismo de autenticação)
      const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '1h' });

      res.json({
        success: true,
        message: 'Login bem-sucedido!',
        token: token,
        username: user.Nome,  // Supondo que o nome do usuário está na coluna 'Nome'
        institution: user.instituicaoNome,
        role: 'Visualizador',
        birthDate: user.Data_de_Nascimento,
        cpf: user.CPF
      });
    } else {
      res.status(401).json({ success: false, message: 'Credenciais inválidas!' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


app.post('/api/recordLogout', async (req, res) => {
  const { username, instituicaoNome } = req.body;

  try {
    const connection = await pool.getConnection();
    await connection.execute(
      "INSERT INTO Auditoria (username, instituicaoNome, action) VALUES (?, ?, 'Logout')",
      [username, instituicaoNome]
    );
    connection.release();

    res.json({ message: 'Logout registrado com sucesso.' });
  } catch (error) {
    console.error('Erro ao registrar o logout:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

app.get('/api/AuditEventsByInstitution', async (req, res) => {
  const institutionName = req.query.instituicaoNome;

  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      "SELECT * FROM Auditoria WHERE instituicaoNome = ? ORDER BY timestamp DESC",
      [institutionName]
    );
    connection.release();

    res.json({ auditEvents: rows });
  } catch (error) {
    console.error('Erro ao buscar eventos de auditoria:', error);
    res.status(500).send('Erro interno do servidor');
  }
});


app.post('/programas', async (req, res) => {
  try {
    const { nome_programa, link_form, instituicaoNome } = req.body; // Extraia instituicaoNome
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO programas (nome_programa, link_form, instituicaoNome) VALUES (?, ?, ?)',
      [nome_programa, link_form, instituicaoNome] // Inclua instituicaoNome
    );
    connection.release();
    res.json({ success: true, message: 'Programa criado com sucesso!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erro ao criar programa' });
  }
});

app.get('/programas', async (req, res) => {
  try {
    const instituicaoNome = req.query.instituicaoNome; // Pegue o nome da instituição da query string
    const connection = await pool.getConnection();
    // Modifique a consulta para filtrar com base na coluna "instituicaoNome"
    const [result] = await connection.query('SELECT * FROM programas WHERE instituicaoNome = ?', [instituicaoNome]);
    connection.release();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erro ao listar programas' });
  }
});

app.put('/programas/:id', async (req, res) => {
  try {
    const { nome_programa, link_form } = req.body;
    const { id } = req.params;
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'UPDATE programas SET nome_programa = ?, link_form = ? WHERE id = ?',
      [nome_programa, link_form, id]
    );
    connection.release();
    res.json({ success: true, message: 'Programa atualizado com sucesso!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar programa' });
  }
});


app.delete('/programas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    const [result] = await connection.query('DELETE FROM programas WHERE id = ?', [id]);
    connection.release();
    res.json({ success: true, message: 'Programa excluído com sucesso!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erro ao excluir programa' });
  }
});


app.post('/api/verifyUser', async (req, res) => {
  const { Email } = req.body;
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM cadastro_clientes WHERE Email = ?',
      [Email]
    );
    if (rows.length > 0) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao verificar usuário' });
  }
});
app.post('/api/registerPassword', async (req, res) => {
  const { Email, Senha } = req.body;
  
  if ( !Email || !Senha) {
    return res.status(400).json({ success: false, message: 'Dados incompletos.' });
  }
  
  try {
    await pool.execute(
      'UPDATE cadastro_clientes SET senha = ? WHERE Email = ?',
      [Senha, Email]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Erro no servidor: ", error);
    res.status(500).json({ success: false, message: 'Erro ao cadastrar senha' });
  }
});


app.delete('/deleteAll', async (req, res) => {
  const query = 'DELETE FROM cadastro_clientes';

  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(query);

    if (result.affectedRows > 0) {
      res.send({ success: true, message: `${result.affectedRows} registro(s) foram excluídos.` });
    } else {
      res.send({ success: false, message: 'Não há registros para excluir.' });
    }
  } catch (err) {
    console.log(err);
    return res.send({ success: false, message: 'Falha ao excluir registros: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
});


app.use((req, res, next) => {
  // Se não há token na requisição, passe para a próxima rota
  if (!req.headers.authorization) return next();

  // Decodificar o token
  const token = req.headers.authorization.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
  } catch (error) {
    console.log('Error decoding JWT: ', error);
  }
  

  next();
});

const protectedRoutes = [
  { url: '/deleteAll', methods: ['DELETE'], roles: ['admin'] },
  // Adicione outras rotas protegidas aqui
];

app.use((req, res, next) => {
  if (!req.user) return next();

  const protectedRoute = protectedRoutes.find(
    (route) => route.url === req.path && route.methods.includes(req.method)
  );

  if (protectedRoute && !protectedRoute.roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  next();
});

// Nova rota para obter a contagem de usuários por instituição
app.get('/api/UserCountByInstitution', async (req, res) => {
  const institutionName = req.query.instituicaoNome;

  try {
    // Obter uma conexão do pool
    const connection = await pool.getConnection();

    // Consulta SQL para contar os usuários com o mesmo nome de instituição
    const [rows] = await connection.execute(
      "SELECT COUNT(*) AS count FROM cadastro_clientes WHERE instituicaoNome = ?",
      [institutionName]
    );

    // Liberar a conexão de volta para o pool
    connection.release();

    // Enviar a contagem como resposta
    res.json({ count: rows[0].count });
  } catch (error) {
    console.error('Erro ao contar usuários:', error);
    res.status(500).send('Erro interno do servidor');
  }
});


app.post('/api/RegisterUserActivity', async (req, res) => {
  const { userID, activityType, activityData } = req.body;
  const timestamp = new Date();

  try {
    const connection = await pool.getConnection();
    await connection.execute(
      "INSERT INTO UserActivity (userID, activityType, activityData, timestamp) VALUES (?, ?, ?, ?)",
      [userID, activityType, activityData, timestamp]
    );
    connection.release();
    res.status(200).send('Atividade registrada com sucesso');
  } catch (error) {
    console.error('Erro ao registrar atividade:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

app.put('/cadastro_clientes/:id', async (req, res) => {
  const id = req.params.id;
  const {
      Nome, Sobrenome, Email, Data_de_Nascimento, Genero, Telefone, Telefone2, CPF, CNPJ,
      Matricula, Observacoes, Endereco, Numero, Complemento, Bairro, Cidade, Estado,
      Pais, CEP, Unidade, Setor, Cargo, Instituicao, Acesso, senha
  } = req.body;

  try {
      const connection = await pool.getConnection();

      const query = `
          UPDATE cadastro_clientes SET
              Nome = ?,
              Sobrenome = ?,
              Email = ?,
              Data_de_Nascimento = ?,
              Genero = ?,
              Telefone = ?,
              Telefone2 = ?,
              CPF = ?,
              CNPJ = ?,
              Matricula = ?,
              Observacoes = ?,
              Endereco = ?,
              Numero = ?,
              Complemento = ?,
              Bairro = ?,
              Cidade = ?,
              Estado = ?,
              Pais = ?,
              CEP = ?,
              Unidade = ?,
              Setor = ?,
              Cargo = ?,
              Instituicao = ?,
              Acesso = ?,
              senha = ?

          WHERE id = ?
      `;

      await connection.query(query, [
          Nome, Sobrenome, Email, Data_de_Nascimento, Genero, Telefone, Telefone2, CPF, CNPJ,
          Matricula, Observacoes, Endereco, Numero, Complemento, Bairro, Cidade, Estado,
          Pais, CEP, Unidade, Setor, Cargo, Instituicao, Acesso, senha,
          id
      ]);

      connection.release();
      res.status(200).json({ message: 'Usuário atualizado com sucesso!' });
  } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      res.status(500).json({ message: 'Erro ao atualizar usuário.' });
  }
});


// 3. Deletar um usuário
app.delete('/usuarios/:id', async (req, res) => {
  const userId = req.params.id;

  try {
      const result = await pool.query('DELETE FROM cadastro_clientes WHERE id = ?', [userId]);
      if (result[0].affectedRows === 0) {
          res.status(404).send('Usuário não encontrado.');
          return;
      }
      res.send('Usuário deletado com sucesso.');
  } catch (error) {
      console.error(error);
      res.status(500).send('Erro ao deletar usuário.');
  }
});


const port = process.env.PORT || 5000;

app.listen(port, () => console.log(`Server is running on port ${port}`));