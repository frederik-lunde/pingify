import app from './app';
import { config } from './config/config';
import './utils/monitorWebsites';

const PORT = config.port || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
