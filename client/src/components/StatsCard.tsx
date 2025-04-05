// src/components/StatsCard.tsx
import React from "react";
import { Card, CardContent, Typography } from "@mui/material"; // Box might not be needed

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  // Allow MUI color types or 'default'
  color?: "primary" | "secondary" | "success" | "warning" | "error" | "info" | "default";
}

/**
 * A simple card component to display a key statistic.
 */
const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  color = "default", // Default to 'default' color handling by Typography
}) => {
  return (
    <Card sx={{ height: '100%' }}> {/* Ensure cards take full height if in a grid */}
      <CardContent>
        {/* Title of the statistic */}
        <Typography variant="body1" component="div" color="textSecondary" gutterBottom>
          {title}
        </Typography>
        {/* Main value of the statistic */}
        <Typography
          variant="h4"
          component="div"
          // Apply color directly if it's a recognized MUI color type, otherwise rely on default
          color={color !== "default" ? `${color}.main` : 'text.primary'}
          sx={{ mb: subtitle ? 0.5 : 0 }} // Add margin bottom only if subtitle exists
        >
          {value}
        </Typography>
        {/* Optional subtitle or context */}
        {subtitle && (
          <Typography variant="caption" color="textSecondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default StatsCard;