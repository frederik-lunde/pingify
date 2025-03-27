// src/components/StatsCard.tsx
import React from "react";
import { Card, CardContent, Typography } from "@mui/material";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "primary" | "success" | "warning" | "error" | "default";
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  color = "primary",
}) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="div" gutterBottom>
          {title}
        </Typography>
        <Typography
          variant="h4"
          component="div"
          color={color !== "default" ? color : undefined}
        >
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="textSecondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default StatsCard;
