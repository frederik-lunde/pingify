import React from 'react';
import { 
  Paper, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Chip, 
  useTheme 
} from '@mui/material';
import { MonitoringResult } from '../../types';

interface ResultsTableProps {
  results: MonitoringResult[];
}

const ResultsTable: React.FC<ResultsTableProps> = ({ results }) => {
  const theme = useTheme();
  
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Recent Checks
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Response Time</TableCell>
              <TableCell>Status Code</TableCell>
              <TableCell>Error</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {results.map(result => (
              <TableRow key={result.id} sx={{ 
                backgroundColor: result.isAvailable ? 'transparent' : theme.palette.error.light + '20'
              }}>
                <TableCell>{new Date(result.checkedAt).toLocaleString()}</TableCell>
                <TableCell>
                  <Chip 
                    size="small"
                    label={result.isAvailable ? 'Up' : 'Down'}
                    color={result.isAvailable ? 'success' : 'error'}
                  />
                </TableCell>
                <TableCell>{result.responseTime ? `${result.responseTime}ms` : 'N/A'}</TableCell>
                <TableCell>{result.statusCode || 'N/A'}</TableCell>
                <TableCell>{result.errorMessage || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default ResultsTable;