import axios from 'axios';
import { Website } from '../types';


export const getWebsitesForUser = async (): Promise<Website[]> => {

    try {
        const response = await axios.get(`http://localhost:3001/api/websites/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching websites:', error);
        throw error;
    }
};

export const createWebsite = async (website: Website): Promise<Website> => {
    try {
        const response = await axios.post<Website>(
            'http://localhost:3001/api/websites',
            website,
            {
                headers: { 'Content-Type': 'application/json' },
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error creating website:', error);
        throw error;
    }
}